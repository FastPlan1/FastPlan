const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Planning = require("../models/Planning");
const Trip = require("../models/Trip");
const User = require("../models/User");
const Client = require("../models/Client");
const Notification = require("../models/Notification");
const DemandeReservation = require("../models/DemandeReservation");

const {
  authMiddleware,
  isAdminOrPatron,
  isChauffeur,
} = require("../middleware/authMiddleware");

console.log("📡 Routes de planningRoutes.js chargées !");

// On applique le JWT à toutes les routes
router.use(authMiddleware);

/**
 * GET /api/planning/by-entreprise/:id
 * Récupère tous les plannings d'une entreprise
 */
router.get(
  "/by-entreprise/:id",
  async (req, res) => {
    try {
      const { type, active } = req.query;
      
      // Vérifier les autorisations
      if (req.user.role === "chauffeur" && req.user.entrepriseId.toString() !== req.params.id) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }
      
      const query = { entrepriseId: req.params.id };
      
      // Filtre par type si spécifié
      if (type) {
        query.type = type;
      }
      
      // Filtre par état actif si spécifié
      if (active !== undefined) {
        query.isActive = active === "true";
      }
      
      // Si l'utilisateur est un chauffeur, limiter aux plannings auxquels il a accès
      if (req.user.role === "chauffeur") {
        query.$or = [
          { type: "general" },
          { chauffeurId: req.user._id },
          { "teamIds": req.user._id },
          { "sharedWith.userId": req.user._id }
        ];
      }
      
      const plannings = await Planning.find(query)
        .populate("chauffeurId", "name email phone")
        .populate("ownerId", "name")
        .populate("sharedWith.userId", "name role")
        .select("-entries"); // Ne pas récupérer les entrées pour alléger la réponse
      
      res.json(plannings);
    } catch (err) {
      console.error("❌ Erreur récupération plannings:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * GET /api/planning/:id
 * Récupère un planning spécifique
 */
router.get(
  "/:id",
  async (req, res) => {
    try {
      const planning = await Planning.findById(req.params.id)
        .populate("chauffeurId", "name email phone")
        .populate("ownerId", "name")
        .populate({
          path: "entries.assignedTo.chauffeurId",
          select: "name phone email"
        })
        .populate({
          path: "entries.clientId",
          select: "name phone email company"
        });
      
      if (!planning) {
        return res.status(404).json({ message: "Planning non trouvé" });
      }
      
      // Vérifier les autorisations d'accès
      const isOwner = planning.ownerId && planning.ownerId._id.toString() === req.user.id;
      const isAssigned = planning.chauffeurId && planning.chauffeurId._id.toString() === req.user.id;
      const isTeamMember = planning.teamIds && planning.teamIds.some(id => id.toString() === req.user.id);
      const isShared = planning.sharedWith && planning.sharedWith.some(share => share.userId.toString() === req.user.id);
      const isAdmin = req.user.role === "admin" || req.user.role === "patron";
      const sameEntreprise = planning.entrepriseId.toString() === req.user.entrepriseId.toString();
      
      if (!(isOwner || isAssigned || isTeamMember || isShared || (isAdmin && sameEntreprise) || planning.type === "general")) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }
      
      res.json(planning);
    } catch (err) {
      console.error("❌ Erreur récupération planning:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * GET /api/planning/:id/entries
 * Récupère les entrées d'un planning avec filtres (date, chauffeur, etc.)
 */
router.get(
  "/:id/entries",
  async (req, res) => {
    try {
      const {
        start,
        end,
        chauffeurId,
        status,
        clientId,
        limit = 100,
        page = 1
      } = req.query;
      
      const planning = await Planning.findById(req.params.id);
      
      if (!planning) {
        return res.status(404).json({ message: "Planning non trouvé" });
      }
      
      // Vérifier les autorisations d'accès
      const isOwner = planning.ownerId.toString() === req.user.id;
      const isAssigned = planning.chauffeurId && planning.chauffeurId.toString() === req.user.id;
      const isTeamMember = planning.teamIds && planning.teamIds.some(id => id.toString() === req.user.id);
      const isShared = planning.sharedWith && planning.sharedWith.some(share => share.userId.toString() === req.user.id);
      const isAdmin = req.user.role === "admin" || req.user.role === "patron";
      const sameEntreprise = planning.entrepriseId.toString() === req.user.entrepriseId.toString();
      
      if (!(isOwner || isAssigned || isTeamMember || isShared || (isAdmin && sameEntreprise) || planning.type === "general")) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }
      
      // Construction du pipeline d'agrégation
      const pipeline = [
        { $match: { _id: mongoose.Types.ObjectId(req.params.id) } },
        { $unwind: "$entries" }
      ];
      
      // Filtre par date
      if (start || end) {
        const dateFilter = {};
        if (start) {
          dateFilter["entries.startDateTime"] = { $gte: new Date(start) };
        }
        if (end) {
          if (!dateFilter["entries.startDateTime"]) {
            dateFilter["entries.startDateTime"] = {};
          }
          dateFilter["entries.startDateTime"].$lte = new Date(end);
        }
        
        pipeline.push({ $match: dateFilter });
      }
      
      // Filtre par chauffeur
      if (chauffeurId) {
        pipeline.push({
          $match: {
            "entries.assignedTo.chauffeurId": mongoose.Types.ObjectId(chauffeurId)
          }
        });
      }
      
      // Filtre par statut
      if (status) {
        pipeline.push({
          $match: { "entries.status": status }
        });
      }
      
      // Filtre par client
      if (clientId) {
        pipeline.push({
          $match: { "entries.clientId": mongoose.Types.ObjectId(clientId) }
        });
      }
      
      // Tri par date de début
      pipeline.push({ $sort: { "entries.startDateTime": 1 } });
      
      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: parseInt(limit) });
      
      // Lookup pour les clients et chauffeurs
      pipeline.push({
        $lookup: {
          from: "users",
          localField: "entries.assignedTo.chauffeurId",
          foreignField: "_id",
          as: "chauffeur"
        }
      });
      
      pipeline.push({
        $lookup: {
          from: "clients",
          localField: "entries.clientId",
          foreignField: "_id",
          as: "client"
        }
      });
      
      // Projection finale
      pipeline.push({
        $project: {
          _id: "$entries._id",
          title: "$entries.title",
          startDateTime: "$entries.startDateTime",
          endDateTime: "$entries.endDateTime",
          status: "$entries.status",
          pickup: "$entries.pickup",
          destination: "$entries.destination",
          price: "$entries.price",
          clientId: "$entries.clientId",
          client: { $arrayElemAt: ["$client", 0] },
          assignedTo: "$entries.assignedTo",
          chauffeurs: "$chauffeur",
          notes: "$entries.notes",
          fromReservation: "$entries.fromReservation",
          priority: "$entries.priority",
          color: "$entries.color",
          tags: "$entries.tags"
        }
      });
      
      const results = await Planning.aggregate(pipeline);
      
      // Compter le total des entrées pour la pagination
      const countPipeline = [...pipeline];
      // Retirer la pagination et la projection du pipeline de comptage
      countPipeline.splice(countPipeline.length - 3, 3);
      countPipeline.push({ $count: "total" });
      
      const countResult = await Planning.aggregate(countPipeline);
      const total = countResult.length > 0 ? countResult[0].total : 0;
      
      res.json({
        entries: results,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (err) {
      console.error("❌ Erreur récupération entrées planning:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * POST /api/planning
 * Crée un nouveau planning
 */
router.post(
  "/",
  async (req, res) => {
    try {
      const {
        name,
        type,
        chauffeurId,
        teamIds,
        entrepriseId,
        visibility,
        color,
        settings
      } = req.body;
      
      // Vérifications des permissions
      if (type === "general" && req.user.role !== "admin" && req.user.role !== "patron") {
        return res.status(403).json({ message: "Seuls les administrateurs peuvent créer des plannings généraux" });
      }
      
      if (req.user.role === "chauffeur" && type !== "personal") {
        return res.status(403).json({ message: "Les chauffeurs ne peuvent créer que des plannings personnels" });
      }
      
      // Vérifier que l'entreprise correspond bien à celle de l'utilisateur
      if (entrepriseId !== req.user.entrepriseId.toString()) {
        return res.status(403).json({ message: "Vous ne pouvez pas créer un planning pour une autre entreprise" });
      }
      
      // Création du planning
      const newPlanning = new Planning({
        name,
        type,
        entrepriseId,
        ownerId: req.user.id,
        chauffeurId: type === "personal" ? (chauffeurId || req.user.id) : chauffeurId,
        teamIds: teamIds || [],
        visibility: visibility || "private",
        color: color || "#3788d8",
        settings: settings || {},
        entries: []
      });
      
      await newPlanning.save();
      
      res.status(201).json(newPlanning);
    } catch (err) {
      console.error("❌ Erreur création planning:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * PUT /api/planning/:id
 * Met à jour un planning existant
 */
router.put(
  "/:id",
  async (req, res) => {
    try {
      const {
        name,
        chauffeurId,
        teamIds,
        visibility,
        color,
        isActive,
        settings,
        sharedWith
      } = req.body;
      
      const planning = await Planning.findById(req.params.id);
      
      if (!planning) {
        return res.status(404).json({ message: "Planning non trouvé" });
      }
      
      // Vérifier les permissions
      const isOwner = planning.ownerId.toString() === req.user.id;
      const isAdmin = req.user.role === "admin" || req.user.role === "patron";
      const hasAdminShare = planning.sharedWith && planning.sharedWith.some(
        share => share.userId.toString() === req.user.id && share.permission === "admin"
      );
      
      if (!(isOwner || isAdmin || hasAdminShare)) {
        return res.status(403).json({ message: "Vous n'avez pas les droits pour modifier ce planning" });
      }
      
      // Sécurité: vérifier que les champs spécifiés peuvent être modifiés par l'utilisateur
      if (!isAdmin && planning.type === "general") {
        return res.status(403).json({ message: "Seuls les administrateurs peuvent modifier les plannings généraux" });
      }
      
      // Mise à jour des champs
      if (name) planning.name = name;
      if (chauffeurId !== undefined) planning.chauffeurId = chauffeurId;
      if (teamIds) planning.teamIds = teamIds;
      if (visibility) planning.visibility = visibility;
      if (color) planning.color = color;
      if (isActive !== undefined) planning.isActive = isActive;
      if (settings) {
        planning.settings = {
          ...planning.settings,
          ...settings
        };
      }
      if (sharedWith) planning.sharedWith = sharedWith;
      
      await planning.save();
      
      res.json(planning);
    } catch (err) {
      console.error("❌ Erreur mise à jour planning:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * DELETE /api/planning/:id
 * Supprime un planning
 */
router.delete(
  "/:id",
  async (req, res) => {
    try {
      const planning = await Planning.findById(req.params.id);
      
      if (!planning) {
        return res.status(404).json({ message: "Planning non trouvé" });
      }
      
      // Vérifier les permissions
      const isOwner = planning.ownerId.toString() === req.user.id;
      const isAdmin = req.user.role === "admin" || req.user.role === "patron";
      
      if (!(isOwner || isAdmin)) {
        return res.status(403).json({ message: "Vous n'avez pas les droits pour supprimer ce planning" });
      }
      
      if (planning.type === "general" && !isAdmin) {
        return res.status(403).json({ message: "Seuls les administrateurs peuvent supprimer les plannings généraux" });
      }
      
      await Planning.findByIdAndDelete(req.params.id);
      
      res.json({ message: "Planning supprimé avec succès" });
    } catch (err) {
      console.error("❌ Erreur suppression planning:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * POST /api/planning/:id/entries
 * Ajoute une nouvelle entrée à un planning
 */
router.post(
  "/:id/entries",
  async (req, res) => {
    try {
      const planning = await Planning.findById(req.params.id);
      
      if (!planning) {
        return res.status(404).json({ message: "Planning non trouvé" });
      }
      
      // Vérifier les permissions
      const isOwner = planning.ownerId.toString() === req.user.id;
      const isAdmin = req.user.role === "admin" || req.user.role === "patron";
      const hasWriteAccess = planning.sharedWith && planning.sharedWith.some(
        share => share.userId.toString() === req.user.id && 
        (share.permission === "write" || share.permission === "admin")
      );
      
      if (!(isOwner || isAdmin || hasWriteAccess)) {
        return res.status(403).json({ message: "Vous n'avez pas les droits pour ajouter des entrées à ce planning" });
      }
      
      const {
        title,
        tripId,
        clientId,
        startDateTime,
        endDateTime,
        estimatedDuration,
        pickup,
        destination,
        stops,
        price,
        isFixedPrice,
        status,
        assignedTo,
        notes,
        priority,
        isRecurring,
        recurrencePattern,
        color,
        tags,
        fromReservation,
        reservationId,
        externalChauffeur,
        isExternal
      } = req.body;
      
      // Validation des données requises
      if (!title || !startDateTime || !pickup || !destination) {
        return res.status(400).json({
          message: "Veuillez fournir toutes les informations requises (titre, date/heure, lieu de prise en charge et destination)"
        });
      }
      
      // Création de l'entrée
      const newEntry = {
        title,
        tripId,
        clientId,
        startDateTime: new Date(startDateTime),
        endDateTime: endDateTime ? new Date(endDateTime) : undefined,
        estimatedDuration,
        pickup,
        destination,
        stops: stops || [],
        price,
        isFixedPrice: isFixedPrice || false,
        status: status || "scheduled",
        assignedTo: assignedTo || [],
        notes: notes || { public: "", private: "" },
        priority: priority || "normal",
        color: color || "#3788d8",
        tags: tags || [],
        fromReservation: fromReservation || false,
        reservationId,
        externalChauffeur,
        isExternal: isExternal || false,
        createdBy: req.user.id
      };
      
      // Si récurrent, configurer le motif de récurrence
      if (isRecurring && recurrencePattern) {
        newEntry.isRecurring = true;
        newEntry.recurrencePattern = recurrencePattern;
      }
      
      // Ajouter l'entrée au planning
      planning.entries.push(newEntry);
      
      // Si récurrent, créer les entrées additionnelles
      let recurringEntries = [];
      if (isRecurring && recurrencePattern) {
        const newestEntry = planning.entries[planning.entries.length - 1];
        recurringEntries = await planning.createRecurringEntries(
          newestEntry,
          recurrencePattern,
          recurrencePattern.occurrences || 10
        );
      }
      
      // Sauvegarder les modifications
      await planning.save();
      
      // Si l'entrée est assignée à des chauffeurs, les notifier
      if (assignedTo && assignedTo.length > 0) {
        const io = req.app.get("io");
        
        for (const assignment of assignedTo) {
          // Créer une notification en base de données
          await Notification.create({
            recipient: assignment.chauffeurId,
            entrepriseId: planning.entrepriseId,
            sender: req.user.id,
            type: "trip_assigned",
            title: "Nouvelle course assignée",
            message: `Vous avez une nouvelle course le ${new Date(startDateTime).toLocaleDateString()} à ${new Date(startDateTime).toLocaleTimeString().slice(0, 5)}`,
            data: {
              planningId: planning._id,
              entryId: planning.entries[planning.entries.length - 1]._id,
              title,
              startDateTime,
              pickup,
              destination
            }
          });
          
          // Notification en temps réel si Socket.IO est disponible
          if (io) {
            io.to(`user:${assignment.chauffeurId}`).emit("notification", {
              type: "trip_assigned",
              title: "Nouvelle course assignée",
              message: `Vous avez une nouvelle course le ${new Date(startDateTime).toLocaleDateString()} à ${new Date(startDateTime).toLocaleTimeString().slice(0, 5)}`,
              data: {
                planningId: planning._id,
                entryId: planning.entries[planning.entries.length - 1]._id,
                title,
                startDateTime,
                pickup,
                destination
              },
              timestamp: new Date()
            });
          }
        }
      }
      
      // Si l'entrée vient d'une demande de réservation, mettre à jour la demande
      if (fromReservation && reservationId) {
        await DemandeReservation.findByIdAndUpdate(
          reservationId,
          { 
            status: "accepted",
            planningId: planning._id,
            planningEntryId: planning.entries[planning.entries.length - 1]._id
          }
        );
      }
      
      // Retourner l'entrée avec les éventuelles entrées récurrentes
      res.status(201).json({
        entry: planning.entries[planning.entries.length - 1],
        recurringEntries: recurringEntries.map(e => e._id)
      });
    } catch (err) {
      console.error("❌ Erreur ajout entrée planning:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * PUT /api/planning/:id/entries/:entryId
 * Met à jour une entrée de planning
 */
router.put(
  "/:id/entries/:entryId",
  async (req, res) => {
    try {
      const planning = await Planning.findById(req.params.id);
      
      if (!planning) {
        return res.status(404).json({ message: "Planning non trouvé" });
      }
      
      // Vérifier les permissions
      const isOwner = planning.ownerId.toString() === req.user.id;
      const isAdmin = req.user.role === "admin" || req.user.role === "patron";
      const hasWriteAccess = planning.sharedWith && planning.sharedWith.some(
        share => share.userId.toString() === req.user.id && 
        (share.permission === "write" || share.permission === "admin")
      );
      const isAssignedChauffeur = req.user.role === "chauffeur" && planning.entries.some(
        entry => entry._id.toString() === req.params.entryId && 
        entry.assignedTo.some(a => a.chauffeurId.toString() === req.user.id)
      );
      
      if (!(isOwner || isAdmin || hasWriteAccess || isAssignedChauffeur)) {
        return res.status(403).json({ message: "Vous n'avez pas les droits pour modifier cette entrée" });
      }
      
      // Trouver l'entrée à modifier
      const entryIndex = planning.entries.findIndex(
        entry => entry._id.toString() === req.params.entryId
      );
      
      if (entryIndex === -1) {
        return res.status(404).json({ message: "Entrée non trouvée dans ce planning" });
      }
      
      const currentEntry = planning.entries[entryIndex];
      
      // Si c'est un chauffeur, limiter ce qu'il peut modifier
      if (req.user.role === "chauffeur" && !isAdmin && !isOwner) {
        const allowedFields = ["status", "notes"];
        const requestedFields = Object.keys(req.body);
        
        for (const field of requestedFields) {
          if (!allowedFields.includes(field)) {
            return res.status(403).json({ 
              message: `Les chauffeurs ne peuvent modifier que: ${allowedFields.join(", ")}`
            });
          }
        }
      }
      
      // Mise à jour des champs
      if (req.body.title) currentEntry.title = req.body.title;
      if (req.body.startDateTime) currentEntry.startDateTime = new Date(req.body.startDateTime);
      if (req.body.endDateTime) currentEntry.endDateTime = new Date(req.body.endDateTime);
      if (req.body.estimatedDuration) currentEntry.estimatedDuration = req.body.estimatedDuration;
      if (req.body.pickup) currentEntry.pickup = req.body.pickup;
      if (req.body.destination) currentEntry.destination = req.body.destination;
      if (req.body.stops) currentEntry.stops = req.body.stops;
      if (req.body.price) currentEntry.price = req.body.price;
      if (req.body.isFixedPrice !== undefined) currentEntry.isFixedPrice = req.body.isFixedPrice;
      if (req.body.status) {
        const oldStatus = currentEntry.status;
        currentEntry.status = req.body.status;
        
        // Si le statut change vers "completed", mettre à jour d'autres champs
        if (oldStatus !== "completed" && req.body.status === "completed") {
          // Si pas de date de fin, la définir maintenant
          if (!currentEntry.endDateTime) {
            currentEntry.endDateTime = new Date();
          }
          
          // Si c'est lié à un trajet, mettre à jour le trajet aussi
          if (currentEntry.tripId) {
            await Trip.findByIdAndUpdate(currentEntry.tripId, { 
              status: "completed",
              completed: true,
              endTime: new Date()
            });
          }
        }
      }
      if (req.body.clientId) currentEntry.clientId = req.body.clientId;
      if (req.body.assignedTo) currentEntry.assignedTo = req.body.assignedTo;
      if (req.body.notes) {
        // Fusionner les notes plutôt que de les remplacer complètement
        currentEntry.notes = {
          ...currentEntry.notes,
          ...req.body.notes
        };
      }
      if (req.body.priority) currentEntry.priority = req.body.priority;
      if (req.body.color) currentEntry.color = req.body.color;
      if (req.body.tags) currentEntry.tags = req.body.tags;
      if (req.body.externalChauffeur) currentEntry.externalChauffeur = req.body.externalChauffeur;
      if (req.body.isExternal !== undefined) currentEntry.isExternal = req.body.isExternal;
      
      // Mise à jour de l'horodatage
      currentEntry.updatedBy = req.user.id;
      
      await planning.save();
      
      // Notifier les chauffeurs si leur assignation a changé
      if (req.body.assignedTo) {
        const io = req.app.get("io");
        const newChauffeurs = req.body.assignedTo
          .filter(a => !currentEntry.assignedTo.some(
            existing => existing.chauffeurId.toString() === a.chauffeurId.toString()
          ))
          .map(a => a.chauffeurId);
        
        for (const chauffeurId of newChauffeurs) {
          // Notification en DB
          await Notification.create({
            recipient: chauffeurId,
            entrepriseId: planning.entrepriseId,
            sender: req.user.id,
            type: "trip_assigned",
            title: "Nouvelle course assignée",
            message: `Vous avez été assigné à une course le ${new Date(currentEntry.startDateTime).toLocaleDateString()} à ${new Date(currentEntry.startDateTime).toLocaleTimeString().slice(0, 5)}`,
            data: {
              planningId: planning._id,
              entryId: currentEntry._id,
              title: currentEntry.title,
              startDateTime: currentEntry.startDateTime,
              pickup: currentEntry.pickup,
              destination: currentEntry.destination
            }
          });
          
          // Notification en temps réel
          if (io) {
            io.to(`user:${chauffeurId}`).emit("notification", {
              type: "trip_assigned",
              title: "Nouvelle course assignée",
              message: `Vous avez été assigné à une course le ${new Date(currentEntry.startDateTime).toLocaleDateString()} à ${new Date(currentEntry.startDateTime).toLocaleTimeString().slice(0, 5)}`,
              data: {
                planningId: planning._id,
                entryId: currentEntry._id,
                title: currentEntry.title,
                startDateTime: currentEntry.startDateTime,
                pickup: currentEntry.pickup,
                destination: currentEntry.destination
              },
              timestamp: new Date()
            });
          }
        }
      }
      
      // Si le statut a changé, notifier les personnes concernées
      if (req.body.status) {
        const io = req.app.get("io");
        
        // Notifier le patron/admin du changement de statut
        if (req.user.role === "chauffeur") {
          // Trouver les administrateurs et le patron
          const admins = await User.find({
            entrepriseId: planning.entrepriseId,
            role: { $in: ["admin", "patron"] }
          }).select("_id");
          
          for (const admin of admins) {
            // Notification en DB
            await Notification.create({
              recipient: admin._id,
              entrepriseId: planning.entrepriseId,
              sender: req.user.id,
              type: "trip_update",
              title: `Course ${req.body.status === "completed" ? "terminée" : "mise à jour"}`,
              message: `Le statut de la course "${currentEntry.title}" a été changé en "${req.body.status}"`,
              data: {
                planningId: planning._id,
                entryId: currentEntry._id,
                status: req.body.status
              }
            });
            
            // Notification en temps réel
            if (io) {
              io.to(`user:${admin._id}`).emit("notification", {
                type: "trip_update",
                title: `Course ${req.body.status === "completed" ? "terminée" : "mise à jour"}`,
                message: `Le statut de la course "${currentEntry.title}" a été changé en "${req.body.status}"`,
                data: {
                  planningId: planning._id,
                  entryId: currentEntry._id,
                  status: req.body.status
                },
                timestamp: new Date()
              });
            }
          }
        }
        
        // Si admin/patron, notifier les chauffeurs assignés
        else if (req.user.role === "admin" || req.user.role === "patron") {
          const assignedChauffeurs = currentEntry.assignedTo.map(a => a.chauffeurId);
          
          for (const chauffeurId of assignedChauffeurs) {
            // Notification en DB
            await Notification.create({
              recipient: chauffeurId,
              entrepriseId: planning.entrepriseId,
              sender: req.user.id,
              type: "trip_update",
              title: `Statut de course mis à jour`,
              message: `Le statut de la course "${currentEntry.title}" a été changé en "${req.body.status}"`,
              data: {
                planningId: planning._id,
                entryId: currentEntry._id,
                status: req.body.status
              }
            });
            
            // Notification en temps réel
            if (io) {
              io.to(`user:${chauffeurId}`).emit("notification", {
                type: "trip_update",
                title: `Statut de course mis à jour`,
                message: `Le statut de la course "${currentEntry.title}" a été changé en "${req.body.status}"`,
                data: {
                  planningId: planning._id,
                  entryId: currentEntry._id,
                  status: req.body.status
                },
                timestamp: new Date()
              });
            }
          }
        }
      }
      
      res.json(currentEntry);
    } catch (err) {
      console.error("❌ Erreur mise à jour entrée planning:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * DELETE /api/planning/:id/entries/:entryId
 * Supprime une entrée de planning
 */
router.delete(
  "/:id/entries/:entryId",
  async (req, res) => {
    try {
      const planning = await Planning.findById(req.params.id);
      
      if (!planning) {
        return res.status(404).json({ message: "Planning non trouvé" });
      }
      
      // Vérifier les permissions
      const isOwner = planning.ownerId.toString() === req.user.id;
      const isAdmin = req.user.role === "admin" || req.user.role === "patron";
      const hasAdminAccess = planning.sharedWith && planning.sharedWith.some(
        share => share.userId.toString() === req.user.id && share.permission === "admin"
      );
      
      if (!(isOwner || isAdmin || hasAdminAccess)) {
        return res.status(403).json({ message: "Vous n'avez pas les droits pour supprimer cette entrée" });
      }
      
      // Trouver l'entrée à supprimer
      const entryIndex = planning.entries.findIndex(
        entry => entry._id.toString() === req.params.entryId
      );
      
      if (entryIndex === -1) {
        return res.status(404).json({ message: "Entrée non trouvée dans ce planning" });
      }
      
      const removedEntry = planning.entries[entryIndex];
      
      // Si c'est une demande de réservation, mettre à jour son statut
      if (removedEntry.fromReservation && removedEntry.reservationId) {
        await DemandeReservation.findByIdAndUpdate(
          removedEntry.reservationId,
          { status: "cancelled" }
        );
      }
      
      // Supprimer l'entrée
      planning.entries.splice(entryIndex, 1);
      
      await planning.save();
      
      // Notifier les chauffeurs assignés de la suppression
      const io = req.app.get("io");
      const assignedChauffeurs = removedEntry.assignedTo.map(a => a.chauffeurId);
      
      for (const chauffeurId of assignedChauffeurs) {
        // Notification en DB
        await Notification.create({
          recipient: chauffeurId,
          entrepriseId: planning.entrepriseId,
          sender: req.user.id,
          type: "trip_cancelled",
          title: "Course annulée",
          message: `La course "${removedEntry.title}" prévue le ${new Date(removedEntry.startDateTime).toLocaleDateString()} a été annulée`,
          data: {
            title: removedEntry.title,
            startDateTime: removedEntry.startDateTime
          }
        });
        
        // Notification en temps réel
        if (io) {
          io.to(`user:${chauffeurId}`).emit("notification", {
            type: "trip_cancelled",
            title: "Course annulée",
            message: `La course "${removedEntry.title}" prévue le ${new Date(removedEntry.startDateTime).toLocaleDateString()} a été annulée`,
            data: {
              title: removedEntry.title,
              startDateTime: removedEntry.startDateTime
            },
            timestamp: new Date()
          });
        }
      }
      
      res.json({ message: "Entrée supprimée avec succès" });
    } catch (err) {
      console.error("❌ Erreur suppression entrée planning:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * POST /api/planning/:id/entries/:entryId/assign
 * Assigne ou répond à une assignation pour un chauffeur
 */
router.post(
  "/:id/entries/:entryId/assign",
  async (req, res) => {
    try {
      const { chauffeurId, status, notes } = req.body;
      
      if (!chauffeurId || !status) {
        return res.status(400).json({ message: "Chauffeur et statut requis" });
      }
      
      const planning = await Planning.findById(req.params.id);
      
      if (!planning) {
        return res.status(404).json({ message: "Planning non trouvé" });
      }
      
      // Trouver l'entrée
      const entryIndex = planning.entries.findIndex(
        entry => entry._id.toString() === req.params.entryId
      );
      
      if (entryIndex === -1) {
        return res.status(404).json({ message: "Entrée non trouvée dans ce planning" });
      }
      
      // Vérifier les permissions
      const isAdmin = req.user.role === "admin" || req.user.role === "patron";
      const isAssigned = req.user.role === "chauffeur" && 
                          chauffeurId === req.user.id &&
                          planning.entries[entryIndex].assignedTo.some(
                            a => a.chauffeurId.toString() === req.user.id
                          );
      
      if (!(isAdmin || isAssigned)) {
        return res.status(403).json({ 
          message: isAdmin ? 
            "Vous ne pouvez assigner que vos propres chauffeurs" : 
            "Vous ne pouvez répondre qu'à vos propres assignations"
        });
      }
      
      // Si c'est un admin qui assigne
      if (isAdmin) {
        // Vérifier si le chauffeur est déjà assigné
        const assignmentIndex = planning.entries[entryIndex].assignedTo.findIndex(
          a => a.chauffeurId.toString() === chauffeurId
        );
        
        if (assignmentIndex === -1) {
          // Nouvelle assignation
          planning.entries[entryIndex].assignedTo.push({
            chauffeurId,
            status: "pending",
            assignedAt: new Date()
          });
        } else {
          // Mise à jour de l'assignation existante
          planning.entries[entryIndex].assignedTo[assignmentIndex].status = status;
          if (notes) {
            planning.entries[entryIndex].assignedTo[assignmentIndex].notes = notes;
          }
        }
      } 
      // Si c'est un chauffeur qui répond
      else if (isAssigned) {
        const assignmentIndex = planning.entries[entryIndex].assignedTo.findIndex(
          a => a.chauffeurId.toString() === chauffeurId
        );
        
        if (assignmentIndex === -1) {
          return res.status(404).json({ message: "Assignation non trouvée" });
        }
        
        // Mise à jour du statut de l'assignation
        planning.entries[entryIndex].assignedTo[assignmentIndex].status = status;
        
        // Ajouter des informations supplémentaires selon le statut
        if (status === "accepted") {
          planning.entries[entryIndex].assignedTo[assignmentIndex].acceptedAt = new Date();
        } else if (status === "declined") {
          planning.entries[entryIndex].assignedTo[assignmentIndex].declinedAt = new Date();
          planning.entries[entryIndex].assignedTo[assignmentIndex].declineReason = notes || "";
        }
      }
      
      await planning.save();
      
      // Notification si un chauffeur accepte ou refuse une course
      if (isAssigned && (status === "accepted" || status === "declined")) {
        const io = req.app.get("io");
        
        // Trouver les admins et le propriétaire du planning
        const notifyUserIds = [planning.ownerId.toString()];
        
        // Ajouter les admins/patrons
        const admins = await User.find({
          entrepriseId: planning.entrepriseId,
          role: { $in: ["admin", "patron"] }
        }).select("_id");
        
        admins.forEach(admin => {
          if (!notifyUserIds.includes(admin._id.toString())) {
            notifyUserIds.push(admin._id.toString());
          }
        });
        
        // Envoyer la notification à chaque utilisateur concerné
        for (const userId of notifyUserIds) {
          // Ne pas notifier l'utilisateur qui a fait l'action
          if (userId === req.user.id) continue;
          
          const statusText = status === "accepted" ? "acceptée" : "refusée";
          
          // Notification en DB
          await Notification.create({
            recipient: userId,
            entrepriseId: planning.entrepriseId,
            sender: req.user.id,
            type: "trip_update",
            title: `Course ${statusText}`,
            message: `Le chauffeur ${req.user.name} a ${statusText} la course "${planning.entries[entryIndex].title}"`,
            data: {
              planningId: planning._id,
              entryId: planning.entries[entryIndex]._id,
              chauffeurId: req.user.id,
              chauffeurName: req.user.name,
              status,
              declineReason: notes
            }
          });
          
          // Notification en temps réel
          if (io) {
            io.to(`user:${userId}`).emit("notification", {
              type: "trip_update",
              title: `Course ${statusText}`,
              message: `Le chauffeur ${req.user.name} a ${statusText} la course "${planning.entries[entryIndex].title}"`,
              data: {
                planningId: planning._id,
                entryId: planning.entries[entryIndex]._id,
                chauffeurId: req.user.id,
                chauffeurName: req.user.name,
                status,
                declineReason: notes
              },
              timestamp: new Date()
            });
          }
        }
      }
      
      res.json({
        message: `Assignation ${isAdmin ? "créée" : "mise à jour"} avec succès`,
        assignment: planning.entries[entryIndex].assignedTo.find(
          a => a.chauffeurId.toString() === chauffeurId
        )
      });
    } catch (err) {
      console.error("❌ Erreur assignation entrée planning:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * GET /api/planning/find-available
 * Trouve des créneaux disponibles pour un ou plusieurs chauffeurs
 */
router.get(
  "/find-available",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const {
        entrepriseId,
        chauffeurId,
        date,
        duration = 60
      } = req.query;
      
      if (!entrepriseId || !date) {
        return res.status(400).json({
          message: "ID d'entreprise et date requis"
        });
      }
      
      // Convertir la date au format Date
      const startDate = new Date(date);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ message: "Format de date invalide" });
      }
      
      // Préparer les résultats
      let availableSlots = [];
      
      // Si un chauffeur spécifique est demandé
      if (chauffeurId) {
        // Récupérer tous les plannings pertinents
        const plannings = await Planning.find({
          entrepriseId,
          $or: [
            { type: "general" },
            { chauffeurId }
          ]
        });
        
        // Définir les heures de travail (8h-19h par défaut)
        const workStartHour = 8;
        const workEndHour = 19;
        
        // Calculer tous les créneaux possibles dans la journée
        const slots = [];
        const endDate = new Date(startDate);
        endDate.setHours(workEndHour, 0, 0, 0);
        
        const currentSlot = new Date(startDate);
        currentSlot.setHours(workStartHour, 0, 0, 0);
        
        while (currentSlot < endDate) {
          const slotEnd = new Date(currentSlot);
          slotEnd.setMinutes(currentSlot.getMinutes() + parseInt(duration));
          
          // Vérifier si ce créneau est disponible dans tous les plannings
          let isAvailable = true;
          for (const planning of plannings) {
            const overlappingEntries = planning.entries.filter(entry => {
              // Ne considérer que les entrées pour ce chauffeur
              const isForChauffeur = entry.assignedTo.some(
                a => a.chauffeurId.toString() === chauffeurId && a.status !== "declined"
              );
              
              if (!isForChauffeur) return false;
              
              // Vérifier si le créneau chevauche cette entrée
              const entryStart = new Date(entry.startDateTime);
              const entryEnd = entry.endDateTime ? new Date(entry.endDateTime) : 
                new Date(entryStart.getTime() + (entry.estimatedDuration || 60) * 60000);
              
              return (
                (currentSlot < entryEnd && slotEnd > entryStart) &&
                entry.status !== "cancelled" && 
                entry.status !== "completed"
              );
            });
            
            if (overlappingEntries.length > 0) {
              isAvailable = false;
              break;
            }
          }
          
          if (isAvailable) {
            slots.push({
              start: new Date(currentSlot),
              end: new Date(slotEnd),
              duration: parseInt(duration)
            });
          }
          
          // Avancer d'une demi-heure
          currentSlot.setMinutes(currentSlot.getMinutes() + 30);
        }
        
        availableSlots = slots;
      } 
      // Si aucun chauffeur spécifique n'est demandé, trouver tous les chauffeurs disponibles
      else {
        // Récupérer tous les chauffeurs de l'entreprise
        const chauffeurs = await User.find({
          entrepriseId,
          role: "chauffeur",
          isActive: true
        }).select("_id name");
        
        // Pour chaque chauffeur, vérifier sa disponibilité à l'heure donnée
        const chauffeurDisponibilites = [];
        
        for (const chauffeur of chauffeurs) {
          // Vérifier les entrées du planning pour cette date
          const plannings = await Planning.find({
            entrepriseId,
            $or: [
              { type: "general" },
              { chauffeurId: chauffeur._id }
            ]
          });
          
          // Vérifier si le chauffeur est disponible à cette heure
          let isAvailable = true;
          for (const planning of plannings) {
            const overlappingEntries = planning.entries.filter(entry => {
              // Ne considérer que les entrées pour ce chauffeur
              const isForChauffeur = entry.assignedTo.some(
                a => a.chauffeurId.toString() === chauffeur._id.toString() && a.status !== "declined"
              );
              
              if (!isForChauffeur) return false;
              
              // Vérifier si le créneau demandé chevauche cette entrée
              const entryStart = new Date(entry.startDateTime);
              const entryEnd = entry.endDateTime ? new Date(entry.endDateTime) : 
                new Date(entryStart.getTime() + (entry.estimatedDuration || 60) * 60000);
              
              const slotStart = new Date(startDate);
              const slotEnd = new Date(slotStart);
              slotEnd.setMinutes(slotStart.getMinutes() + parseInt(duration));
              
              return (
                (slotStart < entryEnd && slotEnd > entryStart) &&
                entry.status !== "cancelled" && 
                entry.status !== "completed"
              );
            });
            
            if (overlappingEntries.length > 0) {
              isAvailable = false;
              break;
            }
          }
          
          if (isAvailable) {
            chauffeurDisponibilites.push({
              chauffeurId: chauffeur._id,
              name: chauffeur.name,
              available: true
            });
          }
        }
        
        // Trouver toutes les heures disponibles pour au moins un chauffeur
        const requestedTime = new Date(startDate);
        const slotStart = new Date(requestedTime);
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotStart.getMinutes() + parseInt(duration));
        
        availableSlots = [{
          start: slotStart,
          end: slotEnd,
          duration: parseInt(duration),
          availableChauffeurs: chauffeurDisponibilites
        }];
      }
      
      res.json(availableSlots);
    } catch (err) {
      console.error("❌ Erreur recherche disponibilités:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * POST /api/planning/from-reservation/:reservationId
 * Crée une entrée de planning à partir d'une demande de réservation
 */
router.post(
  "/from-reservation/:reservationId",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const { planningId, chauffeurId } = req.body;
      
      if (!planningId) {
        return res.status(400).json({ message: "ID de planning requis" });
      }
      
      // Récupérer la demande de réservation
      const reservation = await DemandeReservation.findById(req.params.reservationId);
      
      if (!reservation) {
        return res.status(404).json({ message: "Demande de réservation non trouvée" });
      }
      
      if (reservation.status === "accepted") {
        return res.status(400).json({ message: "Cette demande a déjà été acceptée" });
      }
      
      // Récupérer le planning
      const planning = await Planning.findById(planningId);
      
      if (!planning) {
        return res.status(404).json({ message: "Planning non trouvé" });
      }
      
      // Vérifier que l'utilisateur a les droits sur ce planning
      const isOwner = planning.ownerId.toString() === req.user.id;
      const isAdmin = req.user.role === "admin" || req.user.role === "patron";
      const hasWriteAccess = planning.sharedWith && planning.sharedWith.some(
        share => share.userId.toString() === req.user.id && 
        (share.permission === "write" || share.permission === "admin")
      );
      
      if (!(isOwner || isAdmin || hasWriteAccess)) {
        return res.status(403).json({ 
          message: "Vous n'avez pas les droits pour ajouter des entrées à ce planning" 
        });
      }
      
      // Créer une nouvelle entrée de planning
      const newEntry = {
        title: `Course pour ${reservation.clientName}`,
        clientId: reservation.clientId,
        startDateTime: new Date(reservation.date + "T" + reservation.heure),
        estimatedDuration: 60, // Par défaut 1h si non spécifié
        pickup: {
          address: reservation.adresseDepart,
          latitude: reservation.departCoordinates?.latitude,
          longitude: reservation.departCoordinates?.longitude
        },
        destination: {
          address: reservation.adresseArrivee,
          latitude: reservation.arriveeCoordinates?.latitude,
          longitude: reservation.arriveeCoordinates?.longitude
        },
        status: "scheduled",
        price: reservation.prix,
        notes: {
          public: reservation.message || "",
          private: `Demande de réservation acceptée le ${new Date().toLocaleString()}`
        },
        fromReservation: true,
        reservationId: reservation._id,
        createdBy: req.user.id
      };
      
      // Ajouter un chauffeur si spécifié
      if (chauffeurId) {
        newEntry.assignedTo = [{
          chauffeurId,
          status: "pending",
          assignedAt: new Date()
        }];
      }
      
      // Ajouter l'entrée au planning
      planning.entries.push(newEntry);
      await planning.save();
      
      // Mettre à jour le statut de la demande de réservation
      reservation.status = "accepted";
      reservation.planningId = planning._id;
      reservation.planningEntryId = planning.entries[planning.entries.length - 1]._id;
      reservation.traitePar = req.user.id;
      reservation.traiteDate = new Date();
      await reservation.save();
      
      // Notifier le client si possible
      // TODO: Implémenter l'envoi d'un email de confirmation
      
      // Notifier le chauffeur assigné
      if (chauffeurId) {
        const io = req.app.get("io");
        
        // Notification en DB
        await Notification.create({
          recipient: chauffeurId,
          entrepriseId: planning.entrepriseId,
          sender: req.user.id,
          type: "trip_assigned",
          title: "Nouvelle course assignée",
          message: `Vous avez une nouvelle course le ${new Date(newEntry.startDateTime).toLocaleDateString()} à ${new Date(newEntry.startDateTime).toLocaleTimeString().slice(0, 5)}`,
          data: {
            planningId: planning._id,
            entryId: planning.entries[planning.entries.length - 1]._id,
            title: newEntry.title,
            startDateTime: newEntry.startDateTime,
            pickup: newEntry.pickup,
            destination: newEntry.destination
          }
        });
        
        // Notification en temps réel
        if (io) {
          io.to(`user:${chauffeurId}`).emit("notification", {
            type: "trip_assigned",
            title: "Nouvelle course assignée",
            message: `Vous avez une nouvelle course le ${new Date(newEntry.startDateTime).toLocaleDateString()} à ${new Date(newEntry.startDateTime).toLocaleTimeString().slice(0, 5)}`,
            data: {
              planningId: planning._id,
              entryId: planning.entries[planning.entries.length - 1]._id,
              title: newEntry.title,
              startDateTime: newEntry.startDateTime,
              pickup: newEntry.pickup,
              destination: newEntry.destination
            },
            timestamp: new Date()
          });
        }
      }
      
      res.status(201).json({
        message: "Demande de réservation acceptée et ajoutée au planning",
        entry: planning.entries[planning.entries.length - 1]
      });
    } catch (err) {
      console.error("❌ Erreur création entrée depuis réservation:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * POST /api/planning/batch-assign
 * Assigne plusieurs courses à un chauffeur ou une course à plusieurs chauffeurs
 */
router.post(
  "/batch-assign",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const { entries, chauffeurIds } = req.body;
      
      if ((!entries || !entries.length) || (!chauffeurIds || !chauffeurIds.length)) {
        return res.status(400).json({
          message: "Veuillez fournir des entrées et des chauffeurs"
        });
      }
      
      const results = {
        success: [],
        errors: []
      };
      
      // Pour chaque entrée
      for (const entry of entries) {
        if (!entry.planningId || !entry.entryId) {
          results.errors.push({
            entry,
            error: "Identifiants manquants"
          });
          continue;
        }
        
        try {
          const planning = await Planning.findById(entry.planningId);
          
          if (!planning) {
            results.errors.push({
              entry,
              error: "Planning non trouvé"
            });
            continue;
          }
          
          // Vérifier que l'utilisateur a les droits sur ce planning
          const isOwner = planning.ownerId.toString() === req.user.id;
          const isAdmin = req.user.role === "admin" || req.user.role === "patron";
          const hasWriteAccess = planning.sharedWith && planning.sharedWith.some(
            share => share.userId.toString() === req.user.id && 
            (share.permission === "write" || share.permission === "admin")
          );
          
          if (!(isOwner || isAdmin || hasWriteAccess)) {
            results.errors.push({
              entry,
              error: "Accès non autorisé à ce planning"
            });
            continue;
          }
          
          // Trouver l'entrée dans le planning
          const entryIndex = planning.entries.findIndex(e => e._id.toString() === entry.entryId);
          
          if (entryIndex === -1) {
            results.errors.push({
              entry,
              error: "Entrée non trouvée dans ce planning"
            });
            continue;
          }
          
          const currentEntry = planning.entries[entryIndex];
          
          // Pour chaque chauffeur à assigner
          for (const chauffeurId of chauffeurIds) {
            // Vérifier si le chauffeur est déjà assigné
            const existingIndex = currentEntry.assignedTo.findIndex(
              a => a.chauffeurId.toString() === chauffeurId
            );
            
            if (existingIndex === -1) {
              // Nouvelle assignation
              currentEntry.assignedTo.push({
                chauffeurId,
                status: "pending",
                assignedAt: new Date()
              });
            } else {
              // Si l'assignation existe déjà et est "declined", la remettre à "pending"
              if (currentEntry.assignedTo[existingIndex].status === "declined") {
                currentEntry.assignedTo[existingIndex].status = "pending";
                currentEntry.assignedTo[existingIndex].assignedAt = new Date();
                currentEntry.assignedTo[existingIndex].declinedAt = null;
                currentEntry.assignedTo[existingIndex].declineReason = null;
              }
            }
          }
          
          await planning.save();
          
          // Notifier les chauffeurs
          const io = req.app.get("io");
          
          for (const chauffeurId of chauffeurIds) {
            // Notification en DB
            await Notification.create({
              recipient: chauffeurId,
              entrepriseId: planning.entrepriseId,
              sender: req.user.id,
              type: "trip_assigned",
              title: "Nouvelle course assignée",
              message: `Vous avez été assigné à une course le ${new Date(currentEntry.startDateTime).toLocaleDateString()} à ${new Date(currentEntry.startDateTime).toLocaleTimeString().slice(0, 5)}`,
              data: {
                planningId: planning._id,
                entryId: currentEntry._id,
                title: currentEntry.title,
                startDateTime: currentEntry.startDateTime,
                pickup: currentEntry.pickup,
                destination: currentEntry.destination
              }
            });
            
            // Notification en temps réel
            if (io) {
              io.to(`user:${chauffeurId}`).emit("notification", {
                type: "trip_assigned",
                title: "Nouvelle course assignée",
                message: `Vous avez été assigné à une course le ${new Date(currentEntry.startDateTime).toLocaleDateString()} à ${new Date(currentEntry.startDateTime).toLocaleTimeString().slice(0, 5)}`,
                data: {
                  planningId: planning._id,
                  entryId: currentEntry._id,
                  title: currentEntry.title,
                  startDateTime: currentEntry.startDateTime,
                  pickup: currentEntry.pickup,
                  destination: currentEntry.destination
                },
                timestamp: new Date()
              });
            }
          }
          
          results.success.push({
            entry,
            assignedTo: currentEntry.assignedTo
          });
        } catch (err) {
          console.error("❌ Erreur assignation batch:", err);
          results.errors.push({
            entry,
            error: err.message
          });
        }
      }
      
      res.json({
        message: `${results.success.length} assignations réussies, ${results.errors.length} échecs`,
        results
      });
    } catch (err) {
      console.error("❌ Erreur assignation batch:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

module.exports = router;