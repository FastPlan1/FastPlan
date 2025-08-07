const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  // Utilisateur qui reçoit la notification
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Utilisateur qui envoie la notification (optionnel)
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Type de notification
  type: {
    type: String,
    enum: ['course_assigned', 'course_finished', 'course_cancelled', 'reminder', 'system'],
    required: true
  },
  
  // Titre de la notification
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, "Le titre ne peut pas dépasser 100 caractères"]
  },
  
  // Corps du message
  body: {
    type: String,
    required: true,
    trim: true,
    maxlength: [500, "Le message ne peut pas dépasser 500 caractères"]
  },
  
  // Données supplémentaires (pour la navigation, etc.)
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Token Expo Push de l'utilisateur
  expoPushToken: {
    type: String,
    required: true
  },
  
  // Statut de la notification
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
    default: 'pending'
  },
  
  // Date d'envoi
  sentAt: {
    type: Date
  },
  
  // Date de lecture
  readAt: {
    type: Date
  },
  
  // Tentatives d'envoi
  attempts: {
    type: Number,
    default: 0,
    min: [0, "Le nombre de tentatives ne peut pas être négatif"]
  },
  
  // Erreur d'envoi (si échec)
  error: {
    type: String
  },
  
  // Entreprise associée
  entrepriseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entreprise',
    required: true
  }
}, {
  timestamps: true
});

// Index pour améliorer les performances
notificationSchema.index({ recipient: 1, status: 1, createdAt: -1 });
notificationSchema.index({ entrepriseId: 1, type: 1 });
notificationSchema.index({ expoPushToken: 1 });

// Méthodes statiques
notificationSchema.statics.findByRecipient = function(recipientId, limit = 50) {
  return this.find({ recipient: recipientId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'nom prenom email')
    .populate('recipient', 'nom prenom email');
};

notificationSchema.statics.findUnreadByRecipient = function(recipientId) {
  return this.find({ 
    recipient: recipientId, 
    status: { $in: ['sent', 'delivered'] },
    readAt: { $exists: false }
  })
    .sort({ createdAt: -1 })
    .populate('sender', 'nom prenom email');
};

notificationSchema.statics.markAsRead = function(notificationId) {
  return this.findByIdAndUpdate(notificationId, {
    status: 'read',
    readAt: new Date()
  });
};

notificationSchema.statics.markAllAsRead = function(recipientId) {
  return this.updateMany(
    { 
      recipient: recipientId, 
      status: { $in: ['sent', 'delivered'] },
      readAt: { $exists: false }
    },
    {
      status: 'read',
      readAt: new Date()
    }
  );
};

// Méthodes d'instance
notificationSchema.methods.markAsSent = function() {
  this.status = 'sent';
  this.sentAt = new Date();
  this.attempts += 1;
  return this.save();
};

notificationSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  return this.save();
};

notificationSchema.methods.markAsFailed = function(error) {
  this.status = 'failed';
  this.error = error;
  this.attempts += 1;
  return this.save();
};

// Middleware pre-save pour valider les données
notificationSchema.pre('save', function(next) {
  // Validation des données selon le type
  if (this.type === 'course_assigned' && !this.data.courseId) {
    return next(new Error('courseId requis pour les notifications de course assignée'));
  }
  
  if (this.type === 'course_finished' && !this.data.courseId) {
    return next(new Error('courseId requis pour les notifications de course terminée'));
  }
  
  next();
});

// Virtual pour vérifier si la notification est lue
notificationSchema.virtual('isRead').get(function() {
  return this.status === 'read' || this.readAt !== undefined;
});

// Configuration pour inclure les virtuals dans la sérialisation JSON
notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("Notification", notificationSchema);
