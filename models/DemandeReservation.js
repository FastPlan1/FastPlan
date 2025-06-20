const mongoose = require('mongoose');

const EntrepriseSchema = new mongoose.Schema({
  nom: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String 
  },
  telephone: { 
    type: String 
  },
  adresse: { 
    type: String 
  },
  // 🆕 Champ pour gérer les IDs temporaires
  tempId: { 
    type: String, 
    unique: true,
    sparse: true // Permet d'avoir des valeurs null sans conflit
  },
  // Lien de réservation unique généré
  lienReservation: { 
    type: String,
    unique: true,
    sparse: true
  },
  // Métadonnées
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Middleware pour mettre à jour updatedAt
EntrepriseSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index pour optimiser les recherches
EntrepriseSchema.index({ tempId: 1 });
EntrepriseSchema.index({ lienReservation: 1 });

module.exports = mongoose.model('Entreprise', EntrepriseSchema);