const axios = require('axios');
const Notification = require('../models/Notification');

class PushNotificationService {
  constructor() {
    this.expoApiUrl = 'https://exp.host/--/api/v2/push/send';
    this.maxRetries = 3;
  }

  // Envoyer une notification push
  async sendPushNotification(expoPushToken, title, body, data = {}) {
    try {
      const message = {
        to: expoPushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data,
        priority: 'high',
        channelId: 'default',
      };

      const response = await axios.post(this.expoApiUrl, message, {
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      return {
        success: true,
        response: response.data,
      };
    } catch (error) {
      console.error('Erreur envoi notification push:', error);
      return {
        success: false,
        error: error.message,
        response: error.response?.data,
      };
    }
  }

  // Envoyer une notification à un utilisateur
  async sendNotificationToUser(userId, title, body, data = {}) {
    try {
      // Récupérer le token de l'utilisateur
      const notification = await Notification.findOne({
        recipient: userId,
        status: { $in: ['pending', 'sent', 'delivered'] }
      }).sort({ createdAt: -1 });

      if (!notification || !notification.expoPushToken) {
        console.log(`Aucun token trouvé pour l'utilisateur ${userId}`);
        return { success: false, error: 'Token non trouvé' };
      }

      // Envoyer la notification
      const result = await this.sendPushNotification(
        notification.expoPushToken,
        title,
        body,
        data
      );

      // Mettre à jour le statut
      if (result.success) {
        await notification.markAsSent();
      } else {
        await notification.markAsFailed(result.error);
      }

      return result;
    } catch (error) {
      console.error('Erreur envoi notification utilisateur:', error);
      return { success: false, error: error.message };
    }
  }

  // Créer et envoyer une notification de course assignée
  async sendCourseAssignedNotification(course, assignedDriver, assignedBy) {
    try {
      // Récupérer le token du chauffeur
      const driverNotification = await Notification.findOne({
        recipient: assignedDriver._id,
        status: { $in: ['pending', 'sent', 'delivered'] }
      }).sort({ createdAt: -1 });

      if (!driverNotification || !driverNotification.expoPushToken) {
        console.log(`Aucun token trouvé pour le chauffeur ${assignedDriver._id}`);
        return { success: false, error: 'Token chauffeur non trouvé' };
      }

      const title = '🚗 Nouvelle course assignée';
      const body = `Course assignée par ${assignedBy.nom} ${assignedBy.prenom}: ${course.nom} ${course.prenom} - ${course.adresse}`;
      
      const data = {
        type: 'course_assigned',
        courseId: course._id,
        assignedBy: assignedBy._id,
        courseDetails: {
          clientName: `${course.nom} ${course.prenom}`,
          address: course.adresse,
          date: course.dateDebut,
        }
      };

      // Créer la notification en base
      const notification = new Notification({
        recipient: assignedDriver._id,
        sender: assignedBy._id,
        type: 'course_assigned',
        title: title,
        body: body,
        data: data,
        expoPushToken: driverNotification.expoPushToken,
        entrepriseId: course.entrepriseId,
      });

      await notification.save();

      // Envoyer la notification push
      const result = await this.sendPushNotification(
        driverNotification.expoPushToken,
        title,
        body,
        data
      );

      // Mettre à jour le statut
      if (result.success) {
        await notification.markAsSent();
      } else {
        await notification.markAsFailed(result.error);
      }

      return result;
    } catch (error) {
      console.error('Erreur notification course assignée:', error);
      return { success: false, error: error.message };
    }
  }

  // Créer et envoyer une notification de course terminée
  async sendCourseFinishedNotification(course, finishedBy, boss) {
    try {
      // Récupérer le token du patron
      const bossNotification = await Notification.findOne({
        recipient: boss._id,
        status: { $in: ['pending', 'sent', 'delivered'] }
      }).sort({ createdAt: -1 });

      if (!bossNotification || !bossNotification.expoPushToken) {
        console.log(`Aucun token trouvé pour le patron ${boss._id}`);
        return { success: false, error: 'Token patron non trouvé' };
      }

      const title = '✅ Course terminée';
      const body = `${finishedBy.nom} ${finishedBy.prenom} a terminé la course: ${course.nom} ${course.prenom} - ${course.adresse}`;
      
      const data = {
        type: 'course_finished',
        courseId: course._id,
        finishedBy: finishedBy._id,
        courseDetails: {
          clientName: `${course.nom} ${course.prenom}`,
          address: course.adresse,
          prix: course.prix,
          tempsAttente: course.tempsAttente,
        }
      };

      // Créer la notification en base
      const notification = new Notification({
        recipient: boss._id,
        sender: finishedBy._id,
        type: 'course_finished',
        title: title,
        body: body,
        data: data,
        expoPushToken: bossNotification.expoPushToken,
        entrepriseId: course.entrepriseId,
      });

      await notification.save();

      // Envoyer la notification push
      const result = await this.sendPushNotification(
        bossNotification.expoPushToken,
        title,
        body,
        data
      );

      // Mettre à jour le statut
      if (result.success) {
        await notification.markAsSent();
      } else {
        await notification.markAsFailed(result.error);
      }

      return result;
    } catch (error) {
      console.error('Erreur notification course terminée:', error);
      return { success: false, error: error.message };
    }
  }

  // Envoyer des notifications en lot
  async sendBatchNotifications(notifications) {
    const results = [];
    
    for (const notification of notifications) {
      const result = await this.sendPushNotification(
        notification.expoPushToken,
        notification.title,
        notification.body,
        notification.data
      );
      
      results.push({
        notificationId: notification._id,
        result: result
      });
    }
    
    return results;
  }

  // Retry les notifications échouées
  async retryFailedNotifications() {
    try {
      const failedNotifications = await Notification.find({
        status: 'failed',
        attempts: { $lt: this.maxRetries }
      });

      const results = [];
      
      for (const notification of failedNotifications) {
        const result = await this.sendPushNotification(
          notification.expoPushToken,
          notification.title,
          notification.body,
          notification.data
        );

        if (result.success) {
          await notification.markAsSent();
        } else {
          await notification.markAsFailed(result.error);
        }

        results.push({
          notificationId: notification._id,
          result: result
        });
      }

      return results;
    } catch (error) {
      console.error('Erreur retry notifications:', error);
      return [];
    }
  }

  // Nettoyer les anciennes notifications
  async cleanupOldNotifications(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await Notification.deleteMany({
        createdAt: { $lt: cutoffDate },
        status: { $in: ['read', 'failed'] }
      });

      console.log(`Nettoyage: ${result.deletedCount} notifications supprimées`);
      return result.deletedCount;
    } catch (error) {
      console.error('Erreur nettoyage notifications:', error);
      return 0;
    }
  }
}

module.exports = new PushNotificationService(); 