const mongoose = require("mongoose");

const planningSchema = new mongoose.Schema({
  // Informations client
  nom: {
    type: String,
    required: [true, "Le nom est obligatoire"],
    trim: true,
  },
  prenom: {
    type: String,
    required: [true, "Le prénom est obligatoire"],
    trim: true,
  },
  telephone: {
    type: String,
    trim: true,
    default: "",
  },
  caisseSociale: {
    type: String,
    trim: true,
    default: "",
  },
  
  // Itinéraire
  depart: {
    type: String,
    required: [true, "L'adresse de départ est obligatoire"],
    trim: true,
  },
  arrive: {
    type: String,
    required: [true, "L'adresse d'arrivée est obligatoire"],
    trim: true,
  },
  
  // Planification
  date: {
    type: String, // Format YYYY-MM-DD
    required: [true, "La date est obligatoire"],
    validate: {
      validator: function(v) {
        // Validation du format YYYY-MM-DD
        return /^\d{4}-\d{2}-\d{2}$/.test(v);
      },
      message: "Format de date invalide (YYYY-MM-DD)"
    },
  },
  heure: {
    type: String, // Format HH:MM
    required: [true, "L'heure est obligatoire"],
    validate: {
      validator: function(v) {
        // Validation du format HH:MM
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
      },
      message: "Format d'heure invalide (HH:MM)"
    },
  },
  
  // Statut et assignation
  statut: {
    type: String,
    enum: ["En attente", "Assignée", "En cours", "Terminée", "Annulée", "Acceptée", "Refusée"],
    default: "En attente",
  },
  chauffeur: {
    type: String,
    default: "",
  },
  
  // Gestion et organisation
  entrepriseId: {
    type: mongoose.Schema.Types.Mixed, // Accepte ObjectId ou string pour les IDs temporaires
    ref: "Entreprise",
    required: [true, "L'ID de l'entreprise est obligatoire"],
    validate: {
      validator: function(v) {
        // Valide si c'est un ObjectId ou une chaîne avec préfixe "temp-"
        return mongoose.Types.ObjectId.isValid(v) || 
               (typeof v === 'string' && v.startsWith('temp-'));
      },
      message: "L'entrepriseId doit être un ObjectId valide ou une chaîne temporaire"
    }
  },
  color: {
    type: String,
    default: "#5E35B1", // Couleur violette par défaut
  },
  prix: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Contenu
  description: {
    type: String,
    default: "",
  },
  notes: {
    type: String,
    default: "",
  },
  
  // Pièces jointes
  pieceJointe: {
    type: [String], // Chemins vers les fichiers
    default: [],
  },
  
  // Suivi temporel
  dateDebut: {
    type: Date,
    default: null, // Date de début de la course (statut "En cours")
  },
  dateFin: {
    type: Date,
    default: null, // Date de fin de la course (statut "Terminée")
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes pour améliorer les performances de recherche
planningSchema.index({ entrepriseId: 1, date: 1, heure: 1 });
planningSchema.index({ chauffeur: 1, date: 1 });
planningSchema.index({ statut: 1 });
planningSchema.index({ nom: 'text', prenom: 'text', depart: 'text', arrive: 'text', description: 'text' });

// Middleware pour mettre à jour automatiquement updatedAt
planningSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Méthode virtuelle pour obtenir la distance
planningSchema.virtual('distance').get(function() {
  // Cette méthode pourrait être implémentée avec un service de calcul d'itinéraire
  return null;
});

// Méthode virtuelle pour obtenir le nom complet du client
planningSchema.virtual('client').get(function() {
  return `${this.prenom} ${this.nom}`;
});

// Méthode virtuelle pour obtenir la durée de la course
planningSchema.virtual('duree').get(function() {
  if (!this.dateDebut || !this.dateFin) return null;
  
  // Calculer la différence en millisecondes
  const diff = this.dateFin.getTime() - this.dateDebut.getTime();
  
  // Convertir en minutes
  return Math.round(diff / 60000);
});

// Configuration pour inclure les virtuals lorsqu'on convertit en JSON
planningSchema.set('toJSON', { virtuals: true });
planningSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("Planning", planningSchema);