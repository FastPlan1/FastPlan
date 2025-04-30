const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Notification = require("../models/Notification");
const { authMiddleware } = require("../middleware/authMiddleware");

console.log("📡 Routes de notificationRoutes.js chargées !");

// On applique le JWT à toutes les routes
router.use(authMiddleware);

/**
 * GET /api/notifications
 * Récupère les notifications de l'utilisateur
 */
router.get("/", async (req, res) => {
  try {
    const { limit = 20, page = 1, read, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = { recipient: req.user.id };
    
    if (read !== undefined) {
      query.read = read === "true";
    }
    
    if (type) {
      query.type = type;
    }
    
    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("sender", "name"),
      Notification.countDocuments(query)
    ]);
    
    const unreadCount = await Notification.countDocuments({
      recipient: req.user.id,
      read: false
    });
    
    res.json({
      notifications,
      unreadCount,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error("❌ Erreur récupération notifications:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * GET /api/notifications/unread-count
 * Récupère le nombre de notifications non lues
 */
router.get("/unread-count", async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user.id,
      read: false
    });
    
    res.json({ count });
  } catch (err) {
    console.error("❌ Erreur comptage notifications non lues:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * POST /api/notifications/mark-as-read
 * Marque des notifications comme lues
 */
router.post("/mark-as-read", async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids) {
      return res.status(400).json({ message: "Veuillez fournir les IDs des notifications" });
    }
    
    // Si on fournit "all", marquer toutes les notifications comme lues
    if (ids === "all") {
      await Notification.updateMany(
        { recipient: req.user.id, read: false },
        { $set: { read: true } }
      );
      
      return res.json({ message: "Toutes les notifications ont été marquées comme lues" });
    }
    
    // Vérifier que les IDs sont valides
    if (!Array.isArray(ids) || !ids.every(id => mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ message: "Liste d'IDs invalide" });
    }
    
    // Vérifier que les notifications appartiennent à l'utilisateur
    const notifications = await Notification.find({
      _id: { $in: ids },
      recipient: req.user.id
    });
    
    if (notifications.length !== ids.length) {
      return res.status(403).json({ message: "Certaines notifications n'appartiennent pas à l'utilisateur" });
    }
    
    await Notification.updateMany(
      { _id: { $in: ids } },
      { $set: { read: true } }
    );
    
    res.json({ message: `${notifications.length} notifications marquées comme lues` });
  } catch (err) {
    console.error("❌ Erreur marquage notifications:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * DELETE /api/notifications/:id
 * Supprime une notification
 */
router.delete("/:id", async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: "Notification non trouvée" });
    }
    
    // Vérifier que la notification appartient à l'utilisateur
    if (notification.recipient.toString() !== req.user.id) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }
    
    await Notification.findByIdAndDelete(req.params.id);
    
    res.json({ message: "Notification supprimée" });
  } catch (err) {
    console.error("❌ Erreur suppression notification:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * DELETE /api/notifications
 * Supprime toutes les notifications (ou les lues)
 */
router.delete("/", async (req, res) => {
  try {
    const { read } = req.query;
    const query = { recipient: req.user.id };
    
    if (read !== undefined) {
      query.read = read === "true";
    }
    
    const result = await Notification.deleteMany(query);
    
    res.json({
      message: `${result.deletedCount} notifications supprimées`,
      count: result.deletedCount
    });
  } catch (err) {
    console.error("❌ Erreur suppression notifications:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * POST /api/notifications/send
 * Envoie une notification à un ou plusieurs utilisateurs
 * (Accessible uniquement aux admins et patrons)
 */
router.post("/send", async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin ou patron
    if (req.user.role !== "admin" && req.user.role !== "patron") {
      return res.status(403).json({ message: "Accès non autorisé" });
    }
    
    const { recipients, title, message, type, data, urgent, expiresAt, actions } = req.body;
    
    if (!recipients || !title || !message || !type) {
      return res.status(400).json({
        message: "Veuillez fournir les destinataires, le titre, le message et le type"
      });
    }
    
    // Vérifier que le type est valide
    const validTypes = [
      "new_trip", "trip_update", "trip_assigned", "trip_cancelled", "trip_completed",
      "vehicle_update", "employee_added", "role_update", "emergency", "message", "system"
    ];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: "Type de notification invalide" });
    }
    
    let recipientIds = [];
    
    // Traiter les destinataires (peut être un ID, un tableau d'IDs ou "all")
    if (recipients === "all") {
      // Envoyer à tous les membres de l'entreprise
      if (!req.user.entrepriseId) {
        return res.status(400).json({ message: "Aucune entreprise associée à cet utilisateur" });
      }
      
      const User = require("../models/User");
      const users = await User.find({ entrepriseId: req.user.entrepriseId }).select("_id");
      recipientIds = users.map(user => user._id);
    } else if (Array.isArray(recipients)) {
      // Vérifier que tous les IDs sont valides
      if (!recipients.every(id => mongoose.Types.ObjectId.isValid(id))) {
        return res.status(400).json({ message: "Liste de destinataires invalide" });
      }
      recipientIds = recipients;
    } else if (mongoose.Types.ObjectId.isValid(recipients)) {
      // Un seul destinataire
      recipientIds = [recipients];
    } else {
      return res.status(400).json({ message: "Format de destinataires invalide" });
    }
    
    // Créer les notifications
    const notifications = recipientIds.map(recipient => ({
      recipient,
      entrepriseId: req.user.entrepriseId,
      sender: req.user.id,
      type,
      title,
      message,
      data: data || {},
      urgent: urgent || false,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      actions: actions || []
    }));
    
    await Notification.insertMany(notifications);
    
    // Envoyer également les notifications en temps réel si disponible
    const io = req.app.get("io");
    if (io) {
      const notificationData = {
        type,
        title,
        message,
        data: data || {},
        sender: {
          id: req.user.id,
          name: req.user.name
        },
        timestamp: new Date(),
        urgent: urgent || false,
        actions: actions || []
      };
      
      recipientIds.forEach(id => {
        io.to(`user:${id}`).emit("notification", notificationData);
      });
    }
    
    res.status(201).json({
      message: `Notifications envoyées à ${recipientIds.length} destinataires`,
      count: recipientIds.length
    });
  } catch (err) {
    console.error("❌ Erreur envoi notifications:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;