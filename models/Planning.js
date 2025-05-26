const mongoose = require("mongoose");

const planningSchema = new mongoose.Schema({
  // Informations client
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
  telephone: {
    type: String,
    trim: true,
    default: "",
    validate: {
      validator: function(v) {
        // Accepter les numéros vides ou valides (format français/international)
        return !v || /^(?:\+33|0)[1-9](?:[0-9]{8})$/.test(v.replace(/\s/g, ''));
      },
      message: "Format de téléphone invalide"
    }
  },
  caisseSociale: {
    type: String,
    trim: true,
    default: "",
    maxlength: [200, "La caisse sociale ne peut pas dépasser 200 caractères"]
  },
  
  // Itinéraire
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
  
  // Planification
  date: {
    type: String, // Format YYYY-MM-DD
    required: [true, "La date est obligatoire"],
    validate: {
      validator: function(v) {
        // Validation du format YYYY-MM-DD et date valide
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
        
        const date = new Date(v + 'T00:00:00.000Z');
        const [year, month, day] = v.split('-').map(Number);
        
        return date.getUTCFullYear() === year && 
               date.getUTCMonth() === month - 1 && 
               date.getUTCDate() === day;
      },
      message: "Format de date invalide ou date inexistante (YYYY-MM-DD)"
    },
  },
  heure: {
    type: String, // Format HH:MM
    required: [true, "L'heure est obligatoire"],
    validate: {
      validator: function(v) {
        // Validation du format HH:MM et heure valide
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(v)) return false;
        
        const [hours, minutes] = v.split(':').map(Number);
        return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
      },
      message: "Format d'heure invalide (HH:MM)"
    },
  },
  
  // Statut et assignation
  statut: {
    type: String,
    enum: {
      values: ["En attente", "Assignée", "En cours", "Terminée", "Annulée", "Acceptée", "Refusée"],
      message: "Statut invalide"
    },
    default: "En attente",
    index: true // Index pour les requêtes fréquentes
  },
  chauffeur: {
    type: String,
    default: "",
    trim: true,
    maxlength: [100, "Le nom du chauffeur ne peut pas dépasser 100 caractères"],
    index: true // Index pour les requêtes par chauffeur
  },
  
  // Gestion et organisation
  entrepriseId: {
    type: mongoose.Schema.Types.Mixed, // Accepte ObjectId ou string pour les IDs temporaires
    ref: "Entreprise",
    required: [true, "L'ID de l'entreprise est obligatoire"],
    validate: {
      validator: function(v) {
        // Valide si c'est un ObjectId ou une chaîne avec préfixe "temp-"
        if (mongoose.Types.ObjectId.isValid(v)) return true;
        if (typeof v === 'string' && v.startsWith('temp-')) return true;
        return false;
      },
      message: "L'entrepriseId doit être un ObjectId valide ou une chaîne temporaire"
    },
    index: true // Index composé avec date pour optimiser les requêtes
  },
  color: {
    type: String,
    default: "#5E35B1", // Couleur violette par défaut
    validate: {
      validator: function(v) {
        // Validation du format couleur hexadécimal
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
      },
      message: "Format de couleur invalide (hex: #RRGGBB ou #RGB)"
    }
  },
  prix: {
    type: Number,
    default: 0,
    min: [0, "Le prix ne peut pas être négatif"],
    max: [99999.99, "Le prix ne peut pas dépasser 99999.99"],
    validate: {
      validator: function(v) {
        // Vérifier que le prix a au maximum 2 décimales
        return Number.isInteger(v * 100);
      },
      message: "Le prix ne peut avoir que 2 décimales maximum"
    }
  },
  
  // Contenu
  description: {
    type: String,
    default: "",
    trim: true,
    maxlength: [1000, "La description ne peut pas dépasser 1000 caractères"]
  },
  notes: {
    type: String,
    default: "",
    trim: true,
    maxlength: [500, "Les notes ne peuvent pas dépasser 500 caractères"]
  },
  
  // Pièces jointes
  pieceJointe: {
    type: [String], // Chemins vers les fichiers
    default: [],
    validate: {
      validator: function(v) {
        // Limiter le nombre de pièces jointes
        return v.length <= 10;
      },
      message: "Impossible d'avoir plus de 10 pièces jointes"
    }
  },
  
  // Suivi temporel
  dateDebut: {
    type: Date,
    default: null, // Date de début de la course (statut "En cours")
    validate: {
      validator: function(v) {
        // Si dateDebut est définie, elle doit être antérieure ou égale à dateFin
        if (!v || !this.dateFin) return true;
        return v <= this.dateFin;
      },
      message: "La date de début doit être antérieure ou égale à la date de fin"
    }
  },
  dateFin: {
    type: Date,
    default: null, // Date de fin de la course (statut "Terminée")
    validate: {
      validator: function(v) {
        // Si dateFin est définie, elle doit être postérieure ou égale à dateDebut
        if (!v || !this.dateDebut) return true;
        return v >= this.dateDebut;
      },
      message: "La date de fin doit être postérieure ou égale à la date de début"
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true // Ne peut pas être modifié après création
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  
  // Champs additionnels pour les fonctionnalités avancées
  numeroFacture: {
    type: String,
    default: "",
    trim: true,
    sparse: true, // Index sparse pour les valeurs non vides uniquement
    unique: true // Unicité des numéros de facture
  },
  montantTTC: {
    type: Number,
    default: 0,
    min: [0, "Le montant TTC ne peut pas être négatif"]
  },
  tva: {
    type: Number,
    default: 20,
    min: [0, "La TVA ne peut pas être négative"],
    max: [100, "La TVA ne peut pas dépasser 100%"]
  },
  
  // Métadonnées
  version: {
    type: Number,
    default: 1,
    min: 1
  }
}, {
  // Options du schéma
  timestamps: false, // Utiliser nos propres champs createdAt/updatedAt
  collection: 'planning', // Nom explicite de la collection
  strict: true, // Rejeter les champs non définis dans le schéma
  minimize: false, // Garder les objets vides
  versionKey: '__v' // Garder le versioning de Mongoose
});

// Indexes composés pour améliorer les performances de recherche
planningSchema.index({ entrepriseId: 1, date: 1, heure: 1 }); // Requêtes par entreprise et date
planningSchema.index({ entrepriseId: 1, chauffeur: 1, date: 1 }); // Requêtes par chauffeur
planningSchema.index({ entrepriseId: 1, statut: 1 }); // Requêtes par statut
planningSchema.index({ createdAt: -1 }); // Tri par date de création
planningSchema.index({ updatedAt: -1 }); // Tri par date de modification

// Index de recherche textuelle pour la recherche globale
planningSchema.index({ 
  nom: 'text', 
  prenom: 'text', 
  depart: 'text', 
  arrive: 'text', 
  description: 'text',
  notes: 'text'
}, {
  weights: {
    nom: 10,
    prenom: 10,
    depart: 5,
    arrive: 5,
    description: 3,
    notes: 1
  },
  name: 'recherche_textuelle'
});

// Middleware pour mettre à jour automatiquement updatedAt
planningSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date(), version: this.getUpdate().$inc?.version || 1 });
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

// Middleware pour la validation avant sauvegarde
planningSchema.pre('save', function(next) {
  // Mettre à jour updatedAt si le document est modifié
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
    this.version += 1;
  }
  
  // Validation personnalisée de la date/heure par rapport à maintenant
  const courseDateTime = new Date(`${this.date}T${this.heure}:00.000Z`);
  const now = new Date();
  
  // Permettre les courses dans le passé seulement si elles sont en cours ou terminées
  if (courseDateTime < now && !['En cours', 'Terminée', 'Annulée'].includes(this.statut)) {
    console.warn(`Course planifiée dans le passé: ${this.date} ${this.heure}`);
  }
  
  next();
});

// Méthode virtuelle pour obtenir le nom complet du client
planningSchema.virtual('client').get(function() {
  return `${this.prenom} ${this.nom}`.trim();
});

// Méthode virtuelle pour obtenir l'itinéraire complet
planningSchema.virtual('itineraire').get(function() {
  return `${this.depart} → ${this.arrive}`;
});

// Méthode virtuelle pour obtenir la durée de la course
planningSchema.virtual('duree').get(function() {
  if (!this.dateDebut || !this.dateFin) return null;
  
  // Calculer la différence en millisecondes
  const diff = this.dateFin.getTime() - this.dateDebut.getTime();
  
  // Convertir en minutes
  const minutes = Math.round(diff / 60000);
  
  // Retourner un objet avec différentes unités
  return {
    minutes,
    heures: Math.floor(minutes / 60),
    minutesRestantes: minutes % 60,
    formatted: `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
  };
});

// Méthode virtuelle pour obtenir le DateTime complet
planningSchema.virtual('dateTime').get(function() {
  try {
    return new Date(`${this.date}T${this.heure}:00.000Z`);
  } catch (error) {
    return null;
  }
});

// Méthode virtuelle pour vérifier si la course est en retard
planningSchema.virtual('enRetard').get(function() {
  const courseDateTime = this.dateTime;
  if (!courseDateTime) return false;
  
  const now = new Date();
  return courseDateTime < now && this.statut === 'En attente';
});

// Méthode virtuelle pour calculer le montant HT
planningSchema.virtual('montantHT').get(function() {
  if (!this.montantTTC || !this.tva) return this.prix || 0;
  return Math.round((this.montantTTC / (1 + this.tva / 100)) * 100) / 100;
});

// Méthodes d'instance
planningSchema.methods.marquerEnCours = function() {
  this.statut = 'En cours';
  this.dateDebut = new Date();
  return this.save();
};

planningSchema.methods.marquerTerminee = function() {
  this.statut = 'Terminée';
  this.dateFin = new Date();
  
  // Si pas de date de début, l'ajouter maintenant
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

planningSchema.methods.calculerPrixTTC = function() {
  if (!this.prix) return 0;
  return Math.round(this.prix * (1 + this.tva / 100) * 100) / 100;
};

planningSchema.methods.genererNumeroFacture = function() {
  if (this.numeroFacture) return this.numeroFacture;
  
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now().toString().slice(-6);
  
  this.numeroFacture = `F${year}${month}-${timestamp}`;
  return this.numeroFacture;
};

// Méthodes statiques
planningSchema.statics.findByEntreprise = function(entrepriseId, options = {}) {
  const query = { entrepriseId };
  
  if (options.date) {
    query.date = options.date;
  }
  
  if (options.dateDebut && options.dateFin) {
    query.date = { $gte: options.dateDebut, $lte: options.dateFin };
  }
  
  if (options.chauffeur) {
    query.chauffeur = new RegExp(`^${options.chauffeur}$`, 'i');
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

planningSchema.statics.getStatistiques = function(entrepriseId, dateDebut, dateFin) {
  const matchStage = {
    entrepriseId,
    date: { $gte: dateDebut, $lte: dateFin }
  };
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$statut',
        count: { $sum: 1 },
        chiffreAffaires: { $sum: '$prix' },
        chiffreAffairesTTC: { $sum: '$montantTTC' }
      }
    },
    {
      $group: {
        _id: null,
        totalCourses: { $sum: '$count' },
        totalCA: { $sum: '$chiffreAffaires' },
        totalCATTC: { $sum: '$chiffreAffairesTTC' },
        parStatut: {
          $push: {
            statut: '$_id',
            count: '$count',
            ca: '$chiffreAffaires',
            caTTC: '$chiffreAffairesTTC'
          }
        }
      }
    }
  ]);
};

// Configuration pour inclure les virtuals lorsqu'on convertit en JSON
planningSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    // Supprimer les champs internes
    delete ret.__v;
    delete ret._id;
    
    // Garder l'ID sous sa forme originale
    ret.id = doc._id;
    
    return ret;
  }
});

planningSchema.set('toObject', { virtuals: true });

// Plugin pour la pagination (optionnel)
planningSchema.plugin(function(schema) {
  schema.statics.paginate = function(query = {}, options = {}) {
    const page = Math.max(1, parseInt(options.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(options.limit) || 20));
    const skip = (page - 1) * limit;
    
    const countPromise = this.countDocuments(query);
    const docsPromise = this.find(query)
      .sort(options.sort || { date: 1, heure: 1 })
      .skip(skip)
      .limit(limit)
      .lean(options.lean !== false);
    
    return Promise.all([countPromise, docsPromise]).then(([total, docs]) => ({
      docs,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    }));
  };
});

module.exports = mongoose.model("Planning", planningSchema);