const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const Notification = require("../models/Notification");
const pushNotificationService = require("../utils/pushNotificationService");

// Enregistrer le token Expo Push d'un utilisateur
router.post("/register-token", authMiddleware, async (req, res) => {
  try {
    const { expoPushToken, userId, platform } = req.body;
    const currentUser = req.user;

    if (!expoPushToken) {
      return res.status(400).json({ message: "Token Expo requis" });
    }

    // Vérifier que l'utilisateur enregistre son propre token ou est admin
    if (userId && userId !== currentUser._id.toString() && currentUser.role !== 'patron') {
      return res.status(403).json({ message: "Non autorisé" });
    }

    const targetUserId = userId || currentUser._id;

    // Supprimer les anciens tokens pour cet utilisateur
    await Notification.updateMany(
      { recipient: targetUserId },
      { status: 'failed', error: 'Token remplacé' }
    );

    // Créer une nouvelle notification avec le nouveau token
    const notification = new Notification({
      recipient: targetUserId,
      type: 'system',
      title: 'Notifications activées',
      body: 'Vos notifications push sont maintenant activées',
      data: { type: 'token_registered' },
      expoPushToken: expoPushToken,
      entrepriseId: currentUser.entrepriseId,
      status: 'sent'
    });

    await notification.save();

    res.json({
      message: "Token enregistré avec succès",
      notification: notification
    });
  } catch (error) {
    console.error("Erreur enregistrement token:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Obtenir les notifications d'un utilisateur
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const userId = req.user._id;

    let query = { recipient: userId };
    
    if (unreadOnly === 'true') {
      query.status = { $in: ['sent', 'delivered'] };
      query.readAt = { $exists: false };
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('sender', 'nom prenom email')
      .populate('recipient', 'nom prenom email');

    const total = await Notification.countDocuments(query);

    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Erreur récupération notifications:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Marquer une notification comme lue
router.put("/:id/read", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOne({
      _id: id,
      recipient: userId
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification non trouvée" });
    }

    await notification.markAsRead();

    res.json({
      message: "Notification marquée comme lue",
      notification
    });
  } catch (error) {
    console.error("Erreur marquage notification:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Marquer toutes les notifications comme lues
router.put("/read-all", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await Notification.markAllAsRead(userId);

    res.json({
      message: "Toutes les notifications marquées comme lues",
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Erreur marquage notifications:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Supprimer une notification
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipient: userId
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification non trouvée" });
    }

    res.json({
      message: "Notification supprimée",
      notification
    });
  } catch (error) {
    console.error("Erreur suppression notification:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Obtenir les statistiques des notifications
router.get("/stats", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await Notification.aggregate([
      { $match: { recipient: userId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      status: { $in: ['sent', 'delivered'] },
      readAt: { $exists: false }
    });

    const totalCount = await Notification.countDocuments({
      recipient: userId
    });

    res.json({
      stats,
      unreadCount,
      totalCount
    });
  } catch (error) {
    console.error("Erreur statistiques notifications:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Route pour tester l'envoi de notification (admin seulement)
router.post("/test", authMiddleware, async (req, res) => {
  try {
    const { title, body, userId } = req.body;
    const currentUser = req.user;

    // Seuls les patrons peuvent envoyer des notifications de test
    if (currentUser.role !== 'patron') {
      return res.status(403).json({ message: "Non autorisé" });
    }

    if (!title || !body) {
      return res.status(400).json({ message: "Titre et corps requis" });
    }

    const targetUserId = userId || currentUser._id;

    const result = await pushNotificationService.sendNotificationToUser(
      targetUserId,
      title,
      body,
      { type: 'test' }
    );

    res.json({
      message: "Notification de test envoyée",
      result
    });
  } catch (error) {
    console.error("Erreur notification de test:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Route pour retry les notifications échouées (admin seulement)
router.post("/retry-failed", authMiddleware, async (req, res) => {
  try {
    const currentUser = req.user;

    if (currentUser.role !== 'patron') {
      return res.status(403).json({ message: "Non autorisé" });
    }

    const results = await pushNotificationService.retryFailedNotifications();

    res.json({
      message: "Retry des notifications échouées terminé",
      results
    });
  } catch (error) {
    console.error("Erreur retry notifications:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Route pour nettoyer les anciennes notifications (admin seulement)
router.delete("/cleanup", authMiddleware, async (req, res) => {
  try {
    const { daysOld = 30 } = req.query;
    const currentUser = req.user;

    if (currentUser.role !== 'patron') {
      return res.status(403).json({ message: "Non autorisé" });
    }

    const deletedCount = await pushNotificationService.cleanupOldNotifications(parseInt(daysOld));

    res.json({
      message: "Nettoyage terminé",
      deletedCount
    });
  } catch (error) {
    console.error("Erreur nettoyage notifications:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router; 