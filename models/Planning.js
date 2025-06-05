const mongoose = require("mongoose");

const planningSchema = new mongoose.Schema({
  // ✅ INFORMATIONS CLIENT (REQUIS)
  nom: {
    type: String,
    required: [true, "Le nom est obligatoire"],
    trim: true,
    maxlength: [100, "Le nom ne peut pas dépasser 100 caractères"],
    minlength: [1, "Le nom doit contenir au moins 1 caractère"]
  },
  prenom: {
    type: String,
    required: [true, "Le prénom est obligatoire"],
    trim: true,
    maxlength: [100, "Le prénom ne peut pas dépasser 100 caractères"],
    minlength: [1, "Le prénom doit contenir au moins 1 caractère"]
  },
  
  // ✅ ITINÉRAIRE (REQUIS)
  depart: {
    type: String,
    required: [true, "L'adresse de départ est obligatoire"],
    trim: true,
    maxlength: [500, "L'adresse de départ ne peut pas dépasser 500 caractères"],
    minlength: [1, "L'adresse de départ doit contenir au moins 1 caractère"]
  },
  arrive: {
    type: String,
    required: [true, "L'adresse d'arrivée est obligatoire"],
    trim: true,
    maxlength: [500, "L'adresse d'arrivée ne peut pas dépasser 500 caractères"],
    minlength: [1, "L'adresse d'arrivée doit contenir au moins 1 caractère"]
  },
  
  // ✅ PLANIFICATION (REQUIS)
  date: {
    type: String, // Format YYYY-MM-DD
    required: [true, "La date est obligatoire"],
    validate: {
      validator: function(v) {
        if (!v || typeof v !== 'string') return false;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
        
        try {
          const date = new Date(v + 'T00:00:00.000Z');
          const [year, month, day] = v.split('-').map(Number);
          
          return date.getUTCFullYear() === year && 
                 date.getUTCMonth() === month - 1 && 
                 date.getUTCDate() === day &&
                 year >= 2020 && year <= 2100;
        } catch (error) {
          return false;
        }
      },
      message: "Format de date invalide ou date inexistante (YYYY-MM-DD)"
    },
  },
  heure: {
    type: String, // Format HH:MM
    required: [true, "L'heure est obligatoire"],
    validate: {
      validator: function(v) {
        if (!v || typeof v !== 'string') return false;
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(v)) return false;
        
        try {
          const [hours, minutes] = v.split(':').map(Number);
          return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
        } catch (error) {
          return false;
        }
      },
      message: "Format d'heure invalide (HH:MM)"
    },
  },
  
  // ✅ DESCRIPTION (OPTIONNEL)
  description: {
    type: String,
    default: "",
    trim: true,
    maxlength: [1000, "La description ne peut pas dépasser 1000 caractères"]
  },
  
  // ✅ COULEUR (OPTIONNEL)
  color: {
    type: String,
    default: "#5E35B1", // Couleur violette par défaut
    validate: {
      validator: function(v) {
        if (!v || typeof v !== 'string') return false;
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
      },
      message: "Format de couleur invalide (hex: #RRGGBB ou #RGB)"
    }
  },
  
  // ✅ GESTION SYSTÈME (AUTOMATIQUE)
  statut: {
    type: String,
    enum: {
      values: ["En attente", "Assignée", "En cours", "Terminée", "Annulée"],
      message: "Statut invalide"
    },
    default: "En attente",
    index: true
  },
  chauffeur: {
    type: String,
    default: "",
    trim: true,
    maxlength: [100, "Le nom du chauffeur ne peut pas dépasser 100 caractères"],
    index: true
  },
  entrepriseId: {
    type: mongoose.Schema.Types.Mixed, // ObjectId ou string temporaire
    ref: "Entreprise",
    required: [true, "L'ID de l'entreprise est obligatoire"],
    validate: {
      validator: function(v) {
        if (mongoose.Types.ObjectId.isValid(v)) return true;
        if (typeof v === 'string' && v.startsWith('temp-')) return true;
        return false;
      },
      message: "L'entrepriseId doit être un ObjectId valide ou une chaîne temporaire"
    },
    index: true
  },
  
  // ✅ HORODATAGE (AUTOMATIQUE)
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  
  // ✅ SUIVI OPTIONNEL (pour les chauffeurs)
  dateDebut: {
    type: Date,
    default: null
  },
  dateFin: {
    type: Date,
    default: null
  },
  
  // ✅ PIÈCES JOINTES OPTIONNELLES
  pieceJointe: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        if (!Array.isArray(v)) return false;
        if (v.length > 10) return false;
        return v.every(item => typeof item === 'string' && item.length > 0);
      },
      message: "Impossible d'avoir plus de 10 pièces jointes ou format invalide"
    }
  }
}, {
  timestamps: false, // Utiliser nos propres champs
  collection: 'planning',
  strict: true,
  minimize: false,
  versionKey: false // Supprimer __v
});

// ✅ INDEX OPTIMISÉS
planningSchema.index({ entrepriseId: 1, date: 1, heure: 1 });
planningSchema.index({ entrepriseId: 1, chauffeur: 1, date: 1 });
planningSchema.index({ entrepriseId: 1, statut: 1 });
planningSchema.index({ createdAt: -1 });

// ✅ INDEX DE RECHERCHE TEXTUELLE
planningSchema.index({ 
  nom: 'text', 
  prenom: 'text', 
  depart: 'text', 
  arrive: 'text', 
  description: 'text'
}, {
  weights: {
    nom: 10,
    prenom: 10,
    depart: 5,
    arrive: 5,
    description: 3
  },
  name: 'recherche_textuelle'
});

// ✅ MIDDLEWARE POUR MISE À JOUR AUTOMATIQUE
planningSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

planningSchema.pre('updateOne', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

planningSchema.pre('updateMany', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

planningSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  
  // Log pour les courses dans le passé (juste informatif)
  try {
    const courseDateTime = new Date(`${this.date}T${this.heure}:00.000Z`);
    const now = new Date();
    
    if (courseDateTime < now && !['En cours', 'Terminée', 'Annulée'].includes(this.statut)) {
      console.warn(`Course planifiée dans le passé: ${this.date} ${this.heure}`);
    }
  } catch (error) {
    console.warn(`Erreur validation date/heure: ${error.message}`);
  }
  
  next();
});

// ✅ PROPRIÉTÉS VIRTUELLES
planningSchema.virtual('client').get(function() {
  return `${this.prenom} ${this.nom}`.trim();
});

planningSchema.virtual('name').get(function() {
  return `${this.prenom || ''} ${this.nom || ''}`.trim() || 'Client sans nom';
});

planningSchema.virtual('itineraire').get(function() {
  return `${this.depart} → ${this.arrive}`;
});

planningSchema.virtual('dateTime').get(function() {
  try {
    return new Date(`${this.date}T${this.heure}:00.000Z`);
  } catch (error) {
    return null;
  }
});

planningSchema.virtual('enRetard').get(function() {
  const courseDateTime = this.dateTime;
  if (!courseDateTime) return false;
  
  const now = new Date();
  return courseDateTime < now && this.statut === 'En attente';
});

planningSchema.virtual('duree').get(function() {
  if (!this.dateDebut || !this.dateFin) return null;
  
  const diff = this.dateFin.getTime() - this.dateDebut.getTime();
  const minutes = Math.round(diff / 60000);
  
  return {
    minutes,
    heures: Math.floor(minutes / 60),
    minutesRestantes: minutes % 60,
    formatted: `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
  };
});

// ✅ MÉTHODES D'INSTANCE
planningSchema.methods.marquerEnCours = function() {
  this.statut = 'En cours';
  this.dateDebut = new Date();
  return this.save();
};

planningSchema.methods.marquerTerminee = function() {
  this.statut = 'Terminée';
  this.dateFin = new Date();
  
  if (!this.dateDebut) {
    this.dateDebut = new Date();
  }
  
  return this.save();
};

planningSchema.methods.assignerChauffeur = function(nomChauffeur, couleur = null) {
  this.chauffeur = nomChauffeur;
  this.statut = 'Assignée';
  
  if (couleur) {
    this.color = couleur;
  }
  
  return this.save();
};

// ✅ MÉTHODES STATIQUES
planningSchema.statics.findByEntreprise = function(entrepriseId, options = {}) {
  const query = { entrepriseId };
  
  if (options.date) {
    query.date = options.date;
  }
  
  if (options.dateDebut && options.dateFin) {
    query.date = { $gte: options.dateDebut, $lte: options.dateFin };
  }
  
  if (options.chauffeur) {
    const escapedChauffeur = options.chauffeur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.chauffeur = new RegExp(`^${escapedChauffeur}$`, 'i');
  }
  
  if (options.statut) {
    query.statut = options.statut;
  }
  
  return this.find(query)
    .sort({ date: 1, heure: 1 })
    .limit(options.limit || 100);
};

planningSchema.statics.findCoursesEnRetard = function(entrepriseId) {
  const maintenant = new Date();
  const dateActuelle = maintenant.toISOString().split('T')[0];
  const heureActuelle = maintenant.toTimeString().substring(0, 5);
  
  return this.find({
    entrepriseId,
    $or: [
      { date: { $lt: dateActuelle } },
      { 
        date: dateActuelle,
        heure: { $lt: heureActuelle }
      }
    ],
    statut: { $in: ['En attente', 'Assignée'] }
  }).sort({ date: -1, heure: -1 });
};

// ✅ CONFIGURATION JSON
planningSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret._id;
    ret.id = doc._id;
    
    // S'assurer que pieceJointe est toujours un tableau
    if (!Array.isArray(ret.pieceJointe)) {
      ret.pieceJointe = [];
    }
    
    return ret;
  }
});

planningSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("Planning", planningSchema);