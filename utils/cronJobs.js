const cron = require("node-cron");
const Trip = require("../models/Trip");
const Vehicle = require("../models/Vehicle");
const User = require("../models/User");
const Notification = require("../models/Notification");

/**
 * Initialise tous les cron jobs pour l'application
 * @param {Object} io - Instance de Socket.IO pour les notifications en temps réel
 */
function setupCronJobs(io) {
  console.log("⏰ Configuration des tâches planifiées...");
  
  // Vérifier les trajets à venir (toutes les 30 minutes)
  cron.schedule("*/30 * * * *", async () => {
    try {
      console.log("🔍 Vérification des trajets à venir...");
      
      const now = new Date();
      const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      
      // Trouver les trajets qui commencent dans les 2 prochaines heures
      const upcomingTrips = await Trip.find({
        scheduledDate: {
          $gte: now,
          $lte: in2Hours
        },
        status: { $in: ["pending", "confirmed"] },
        notifiedUpcoming: { $ne: true } // Flag pour éviter les notifications multiples
      }).populate("chauffeurId", "name _id").populate("entrepriseId", "name _id");
      
      for (const trip of upcomingTrips) {
        // Si le trajet a un chauffeur assigné, le notifier
        if (trip.chauffeurId) {
          await Notification.create({
            recipient: trip.chauffeurId._id,
            entrepriseId: trip.entrepriseId._id,
            type: "trip_update",
            title: "Trajet imminent",
            message: `Vous avez un trajet qui commence dans moins de 2 heures (${trip.scheduledTime})`,
            data: {
              tripId: trip._id,
              reference: trip.reference,
              scheduledTime: trip.scheduledTime
            },
            urgent: true
          });
          
          // Notification en temps réel
          if (io) {
            io.to(`user:${trip.chauffeurId._id}`).emit("notification", {
              type: "trip_update",
              title: "Trajet imminent",
              message: `Vous avez un trajet qui commence dans moins de 2 heures (${trip.scheduledTime})`,
              data: {
                tripId: trip._id,
                reference: trip.reference,
                scheduledTime: trip.scheduledTime
              },
              urgent: true,
              timestamp: new Date()
            });
          }
        }
        
        // Notifier également les administrateurs pour les trajets sans chauffeur
        if (!trip.chauffeurId || trip.status === "pending") {
          const admins = await User.find({
            entrepriseId: trip.entrepriseId._id,
            role: { $in: ["admin", "patron"] }
          }).select("_id");
          
          for (const admin of admins) {
            await Notification.create({
              recipient: admin._id,
              entrepriseId: trip.entrepriseId._id,
              type: "trip_update",
              title: "Trajet sans chauffeur",
              message: `Un trajet prévu dans moins de 2 heures n'a pas de chauffeur assigné (${trip.scheduledTime})`,
              data: {
                tripId: trip._id,
                reference: trip.reference,
                scheduledTime: trip.scheduledTime
              },
              urgent: true
            });
            
            // Notification en temps réel
            if (io) {
              io.to(`user:${admin._id}`).emit("notification", {
                type: "trip_update",
                title: "Trajet sans chauffeur",
                message: `Un trajet prévu dans moins de 2 heures n'a pas de chauffeur assigné (${trip.scheduledTime})`,
                data: {
                  tripId: trip._id,
                  reference: trip.reference,
                  scheduledTime: trip.scheduledTime
                },
                urgent: true,
                timestamp: new Date()
              });
            }
          }
        }
        
        // Marquer comme notifié
        await Trip.findByIdAndUpdate(trip._id, { notifiedUpcoming: true });
      }
      
    } catch (err) {
      console.error("❌ Erreur vérification trajets à venir:", err);
    }
  });
  
  // Alertes de maintenance des véhicules (chaque jour à 7h00)
  cron.schedule("0 7 * * *", async () => {
    try {
      console.log("🔍 Vérification des alertes de maintenance des véhicules...");
      
      const now = new Date();
      const in7Days = new Date(now);
      in7Days.setDate(now.getDate() + 7);
      
      // Trouver les véhicules qui ont besoin de maintenance bientôt
      const vehiclesDueMaintenance = await Vehicle.find({
        nextMaintenanceDate: {
          $gte: now,
          $lte: in7Days
        },
        maintenanceAlerted: { $ne: true } // Flag pour éviter les alertes multiples
      }).populate("entrepriseId", "name _id");
      
      for (const vehicle of vehiclesDueMaintenance) {
        // Notifier les administrateurs et patrons
        const admins = await User.find({
          entrepriseId: vehicle.entrepriseId._id,
          role: { $in: ["admin", "patron"] }
        }).select("_id");
        
        const formattedDate = vehicle.nextMaintenanceDate.toLocaleDateString();
        
        for (const admin of admins) {
          await Notification.create({
            recipient: admin._id,
            entrepriseId: vehicle.entrepriseId._id,
            type: "vehicle_update",
            title: "Maintenance véhicule à prévoir",
            message: `Le véhicule ${vehicle.brand} ${vehicle.model} (${vehicle.registrationNumber}) doit être entretenu avant le ${formattedDate}`,
            data: {
              vehicleId: vehicle._id,
              registrationNumber: vehicle.registrationNumber,
              maintenanceDate: vehicle.nextMaintenanceDate
            }
          });
          
          // Notification en temps réel
          if (io) {
            io.to(`user:${admin._id}`).emit("notification", {
              type: "vehicle_update",
              title: "Maintenance véhicule à prévoir",
              message: `Le véhicule ${vehicle.brand} ${vehicle.model} (${vehicle.registrationNumber}) doit être entretenu avant le ${formattedDate}`,
              data: {
                vehicleId: vehicle._id,
                registrationNumber: vehicle.registrationNumber,
                maintenanceDate: vehicle.nextMaintenanceDate
              },
              timestamp: new Date()
            });
          }
        }
        
        // Marquer comme alerté
        await Vehicle.findByIdAndUpdate(vehicle._id, { maintenanceAlerted: true });
      }
      
    } catch (err) {
      console.error("❌ Erreur vérification maintenance véhicules:", err);
    }
  });
  
  // Nettoyer les anciens trajets (une fois par mois, le 1er à 3h00 du matin)
  cron.schedule("0 3 1 * *", async () => {
    try {
      console.log("🧹 Nettoyage des anciens trajets...");
      
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      // Compter les trajets à supprimer pour le log
      const count = await Trip.countDocuments({
        scheduledDate: { $lt: sixMonthsAgo },
        status: { $in: ["completed", "cancelled"] }
      });
      
      // Supprimer les trajets terminés ou annulés de plus de 6 mois
      await Trip.deleteMany({
        scheduledDate: { $lt: sixMonthsAgo },
        status: { $in: ["completed", "cancelled"] }
      });
      
      console.log(`✅ ${count} anciens trajets supprimés`);
      
    } catch (err) {
      console.error("❌ Erreur nettoyage anciens trajets:", err);
    }
  });
  
  // Nettoyer les anciennes notifications (chaque jour à 4h00 du matin)
  cron.schedule("0 4 * * *", async () => {
    try {
      console.log("🧹 Nettoyage des anciennes notifications...");
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Supprimer les notifications lues de plus de 30 jours
      const result = await Notification.deleteMany({
        read: true,
        createdAt: { $lt: thirtyDaysAgo }
      });
      
      console.log(`✅ ${result.deletedCount} anciennes notifications supprimées`);
      
    } catch (err) {
      console.error("❌ Erreur nettoyage anciennes notifications:", err);
    }
  });
  
  // Vérifier les trajets manqués (toutes les heures)
  cron.schedule("0 * * * *", async () => {
    try {
      console.log("🔍 Vérification des trajets manqués...");
      
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
      
      // Trouver les trajets qui auraient dû commencer mais qui sont toujours en attente/confirmés
      const missedTrips = await Trip.find({
        scheduledDate: { $lt: now },
        status: { $in: ["pending", "confirmed"] },
        notifiedMissed: { $ne: true } // Pour éviter les notifications multiples
      }).populate("chauffeurId", "name _id").populate("entrepriseId", "name _id");
      
      for (const trip of missedTrips) {
        // Notifier les administrateurs
        const admins = await User.find({
          entrepriseId: trip.entrepriseId._id,
          role: { $in: ["admin", "patron"] }
        }).select("_id");
        
        const formattedDateTime = `${trip.scheduledDate.toLocaleDateString()} ${trip.scheduledTime}`;
        
        for (const admin of admins) {
          await Notification.create({
            recipient: admin._id,
            entrepriseId: trip.entrepriseId._id,
            type: "trip_update",
            title: "Trajet manqué",
            message: `Le trajet prévu le ${formattedDateTime} (${trip.reference}) n'a pas été commencé`,
            data: {
              tripId: trip._id,
              reference: trip.reference,
              scheduledDate: trip.scheduledDate,
              scheduledTime: trip.scheduledTime
            },
            urgent: true
          });
          
          // Notification en temps réel
          if (io) {
            io.to(`user:${admin._id}`).emit("notification", {
              type: "trip_update",
              title: "Trajet manqué",
              message: `Le trajet prévu le ${formattedDateTime} (${trip.reference}) n'a pas été commencé`,
              data: {
                tripId: trip._id,
                reference: trip.reference,
                scheduledDate: trip.scheduledDate,
                scheduledTime: trip.scheduledTime
              },
              urgent: true,
              timestamp: new Date()
            });
          }
        }
        
        // Si un chauffeur était assigné, le notifier aussi
        if (trip.chauffeurId) {
          await Notification.create({
            recipient: trip.chauffeurId._id,
            entrepriseId: trip.entrepriseId._id,
            type: "trip_update",
            title: "Trajet manqué",
            message: `Vous n'avez pas commencé le trajet prévu le ${formattedDateTime} (${trip.reference})`,
            data: {
              tripId: trip._id,
              reference: trip.reference,
              scheduledDate: trip.scheduledDate,
              scheduledTime: trip.scheduledTime
            },
            urgent: true
          });
          
          // Notification en temps réel
          if (io) {
            io.to(`user:${trip.chauffeurId._id}`).emit("notification", {
              type: "trip_update",
              title: "Trajet manqué",
              message: `Vous n'avez pas commencé le trajet prévu le ${formattedDateTime} (${trip.reference})`,
              data: {
                tripId: trip._id,
                reference: trip.reference,
                scheduledDate: trip.scheduledDate,
                scheduledTime: trip.scheduledTime
              },
              urgent: true,
              timestamp: new Date()
            });
          }
        }
        
        // Marquer comme notifié
        await Trip.findByIdAndUpdate(trip._id, { notifiedMissed: true });
      }
      
    } catch (err) {
      console.error("❌ Erreur vérification trajets manqués:", err);
    }
  });
  
  console.log("✅ Tâches planifiées configurées avec succès");
}

module.exports = { setupCronJobs };