const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const http = require("http");
const { setupSocketIO } = require("./socketio");
const { setupCronJobs } = require("./utils/cronJobs");

// Charger les variables d'environnement
dotenv.config();

// Initialiser l'application Express
const app = express();
const server = http.createServer(app);

// Configurer Socket.IO
const io = setupSocketIO(server);

// Configurer les tâches planifiées (cron jobs)
setupCronJobs(io);

// Rendre io disponible dans les routes
app.set("io", io);

// Middleware
app.use(cors());
app.use(express.json());

// Connecter à la base de données MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connecté à MongoDB"))
  .catch(err => console.error("❌ Erreur de connexion MongoDB:", err));

// Routes API
const authRoutes = require("./routes/authRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const vehicleRoutes = require("./routes/vehicleRoutes");
const tripRoutes = require("./routes/tripRoutes");
const reportingRoutes = require("./routes/reportingRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const planningRoutes = require("./routes/planningRoutes");
const clientsRoutes = require("./routes/clientsRoutes");
const entrepriseRoutes = require("./routes/entrepriseRoutes");
const priceRoutes = require("./routes/priceRoutes");
const promoCodeRoutes = require("./routes/promoCodeRoutes");
const invitationRoutes = require("./routes/invitationRoutes");
const messageRoutes = require("./routes/messageRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const coursesRoutes = require("./routes/coursesRoutes");
const reservationRoutes = require("./routes/reservationRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/reports", reportingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/planning", planningRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/entreprise", entrepriseRoutes);
app.use("/api/price", priceRoutes);
app.use("/api/promocodes", promoCodeRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/courses", coursesRoutes);
app.use("/api/reservations", reservationRoutes);

// Middleware pour intégrer les notifications aux événements de trajet
const Trip = require("./models/Trip");
const Notification = require("./models/Notification");
const User = require("./models/User");

// Observer les mises à jour de Trip pour générer des notifications automatiques
Trip.watch().on("change", async change => {
  try {
    // Ne traiter que les mises à jour et les insertions
    if (change.operationType !== "update" && change.operationType !== "insert") {
      return;
    }
    
    let trip;
    
    // Récupérer les données complètes du trajet
    if (change.operationType === "insert") {
      trip = change.fullDocument;
    } else if (change.operationType === "update") {
      trip = await Trip.findById(change.documentKey._id)
        .populate("chauffeurId", "name")
        .populate("vehicleId", "registrationNumber brand model");
    }
    
    if (!trip) return;
    
    // Variables pour les notifications
    let recipientId;
    let type;
    let title;
    let message;
    let notificationData;
    
    // Logique selon le type de changement
    if (change.operationType === "insert") {
      // Nouveau trajet créé
      // 1. Notification aux admins et patron
      const admins = await User.find({
        entrepriseId: trip.entrepriseId,
        role: { $in: ["admin", "patron"] }
      }).select("_id");
      
      for (const admin of admins) {
        await Notification.create({
          recipient: admin._id,
          entrepriseId: trip.entrepriseId,
          type: "new_trip",
          title: "Nouveau trajet créé",
          message: `Un nouveau trajet a été créé pour le ${new Date(trip.scheduledDate).toLocaleDateString()} à ${trip.scheduledTime}`,
          data: {
            tripId: trip._id,
            reference: trip.reference,
            scheduledDate: trip.scheduledDate,
            scheduledTime: trip.scheduledTime
          }
        });
      }
      
      // 2. Si un chauffeur est assigné, le notifier
      if (trip.chauffeurId) {
        await Notification.create({
          recipient: trip.chauffeurId,
          entrepriseId: trip.entrepriseId,
          type: "trip_assigned",
          title: "Nouveau trajet assigné",
          message: `Vous avez été assigné à un nouveau trajet le ${new Date(trip.scheduledDate).toLocaleDateString()} à ${trip.scheduledTime}`,
          data: {
            tripId: trip._id,
            reference: trip.reference,
            scheduledDate: trip.scheduledDate,
            scheduledTime: trip.scheduledTime,
            pickup: trip.pickup,
            destination: trip.destination
          }
        });
      }
    } else if (change.operationType === "update") {
      // Déterminer ce qui a changé
      const updateDescription = change.updateDescription;
      
      // Si un chauffeur a été assigné
      if (updateDescription.updatedFields && updateDescription.updatedFields.chauffeurId) {
        const chauffeurId = updateDescription.updatedFields.chauffeurId;
        
        // Notifier le chauffeur
        await Notification.create({
          recipient: chauffeurId,
          entrepriseId: trip.entrepriseId,
          type: "trip_assigned",
          title: "Nouveau trajet assigné",
          message: `Vous avez été assigné à un nouveau trajet le ${new Date(trip.scheduledDate).toLocaleDateString()} à ${trip.scheduledTime}`,
          data: {
            tripId: trip._id,
            reference: trip.reference,
            scheduledDate: trip.scheduledDate,
            scheduledTime: trip.scheduledTime,
            pickup: trip.pickup,
            destination: trip.destination
          }
        });
      }
      
      // Si le statut a changé
      if (updateDescription.updatedFields && updateDescription.updatedFields.status) {
        const newStatus = updateDescription.updatedFields.status;
        let statusType;
        let statusTitle;
        let statusMessage;
        
        switch (newStatus) {
          case "confirmed":
            statusType = "trip_update";
            statusTitle = "Trajet confirmé";
            statusMessage = `Le trajet ${trip.reference} a été confirmé`;
            break;
          case "in_progress":
            statusType = "trip_update";
            statusTitle = "Trajet en cours";
            statusMessage = `Le trajet ${trip.reference} a commencé`;
            break;
          case "completed":
            statusType = "trip_completed";
            statusTitle = "Trajet terminé";
            statusMessage = `Le trajet ${trip.reference} est terminé`;
            break;
          case "cancelled":
            statusType = "trip_cancelled";
            statusTitle = "Trajet annulé";
            statusMessage = `Le trajet ${trip.reference} a été annulé`;
            break;
        }
        
        if (statusType) {
          // Notifier les admins et patron
          const admins = await User.find({
            entrepriseId: trip.entrepriseId,
            role: { $in: ["admin", "patron"] }
          }).select("_id");
          
          for (const admin of admins) {
            // Ne pas notifier celui qui a fait le changement (si c'est un admin)
            if (trip.updatedBy && admin._id.toString() === trip.updatedBy.toString()) {
              continue;
            }
            
            await Notification.create({
              recipient: admin._id,
              entrepriseId: trip.entrepriseId,
              type: statusType,
              title: statusTitle,
              message: statusMessage,
              data: {
                tripId: trip._id,
                reference: trip.reference,
                status: newStatus
              }
            });
          }
          
          // Notifier le chauffeur si ce n'est pas lui qui a fait le changement
          if (trip.chauffeurId && 
              (!trip.updatedBy || trip.chauffeurId._id.toString() !== trip.updatedBy.toString())) {
            await Notification.create({
              recipient: trip.chauffeurId._id,
              entrepriseId: trip.entrepriseId,
              type: statusType,
              title: statusTitle,
              message: statusMessage,
              data: {
                tripId: trip._id,
                reference: trip.reference,
                status: newStatus
              }
            });
          }
        }
      }
    }
    
    // Envoyer aussi les notifications en temps réel via Socket.IO si disponible
    if (io && type) {
      io.to(`user:${recipientId}`).emit("notification", {
        type,
        title,
        message,
        data: notificationData,
        timestamp: new Date()
      });
    }
    
  } catch (err) {
    console.error("❌ Erreur génération notification automatique:", err);
  }
});

// Observer les demandes de réservation pour générer des notifications
const DemandeReservation = require("./models/DemandeReservation");

DemandeReservation.watch().on("change", async change => {
  try {
    // Ne traiter que les insertions
    if (change.operationType !== "insert") {
      return;
    }
    
    const reservation = change.fullDocument;
    
    // Notifier les admins et patrons de la nouvelle demande
    const admins = await User.find({
      entrepriseId: reservation.entrepriseId,
      role: { $in: ["admin", "patron"] }
    }).select("_id");
    
    for (const admin of admins) {
      await Notification.create({
        recipient: admin._id,
        entrepriseId: reservation.entrepriseId,
        type: "new_reservation",
        title: "Nouvelle demande de réservation",
        message: `Une nouvelle demande de réservation a été reçue pour le ${new Date(reservation.date).toLocaleDateString()} à ${reservation.heure}`,
        data: {
          reservationId: reservation._id,
          clientName: reservation.clientName,
          date: reservation.date,
          heure: reservation.heure,
          adresseDepart: reservation.adresseDepart,
          adresseArrivee: reservation.adresseArrivee
        },
        urgent: true
      });
      
      // Notification en temps réel
      if (io) {
        io.to(`user:${admin._id}`).emit("notification", {
          type: "new_reservation",
          title: "Nouvelle demande de réservation",
          message: `Une nouvelle demande de réservation a été reçue pour le ${new Date(reservation.date).toLocaleDateString()} à ${reservation.heure}`,
          data: {
            reservationId: reservation._id,
            clientName: reservation.clientName,
            date: reservation.date,
            heure: reservation.heure,
            adresseDepart: reservation.adresseDepart,
            adresseArrivee: reservation.adresseArrivee
          },
          urgent: true,
          timestamp: new Date()
        });
      }
    }
  } catch (err) {
    console.error("❌ Erreur génération notification réservation:", err);
  }
});

// Observer les nouveaux messages pour générer des notifications
const Message = require("./models/Message");

Message.watch().on("change", async change => {
  try {
    // Ne traiter que les insertions
    if (change.operationType !== "insert") {
      return;
    }
    
    const message = change.fullDocument;
    
    // Trouver la conversation pour déterminer les destinataires
    const Conversation = require("./models/Conversation");
    const conversation = await Conversation.findById(message.conversationId)
      .populate("participants", "name");
    
    if (!conversation) return;
    
    // Notifier tous les participants sauf l'expéditeur
    for (const participant of conversation.participants) {
      if (participant._id.toString() !== message.senderId.toString()) {
        await Notification.create({
          recipient: participant._id,
          type: "message",
          title: "Nouveau message",
          message: `${message.senderName || 'Un utilisateur'} vous a envoyé un message`,
          data: {
            conversationId: conversation._id,
            messageId: message._id,
            senderName: message.senderName,
            content: message.text.substring(0, 50) + (message.text.length > 50 ? "..." : "")
          }
        });
        
        // Notification en temps réel
        if (io) {
          io.to(`user:${participant._id}`).emit("notification", {
            type: "message",
            title: "Nouveau message",
            message: `${message.senderName || 'Un utilisateur'} vous a envoyé un message`,
            data: {
              conversationId: conversation._id,
              messageId: message._id,
              senderName: message.senderName,
              content: message.text.substring(0, 50) + (message.text.length > 50 ? "..." : "")
            },
            timestamp: new Date()
          });
        }
      }
    }
  } catch (err) {
    console.error("❌ Erreur génération notification message:", err);
  }
});

// Servir les fichiers statiques en production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "./client/build")));
  
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "./client/build/index.html"));
  });
}

// Middleware de gestion des erreurs
app.use((err, req, res, next) => {
  console.error("❌ Erreur serveur:", err);
  res.status(500).json({
    message: "Une erreur est survenue sur le serveur.",
    error: process.env.NODE_ENV === "production" ? {} : err
  });
});

// Démarrer le serveur
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});