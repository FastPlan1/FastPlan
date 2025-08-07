const mongoose = require("mongoose");

const maintenanceEntrySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  type: {
    type: String,
    required: true,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  cost: {
    type: Number,
    default: 0
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: false });

const vehicleSchema = new mongoose.Schema({
  entrepriseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  titre: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, "Le titre ne peut pas dépasser 100 caractères"]
  },
  registrationNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    unique: true
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ["berline", "citadine", "SUV", "monospace", "utilitaire", "bus", "autre"],
    default: "berline"
  },
  year: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear() + 1
  },
  seats: {
    type: Number,
    min: 1,
    max: 60,
    default: 5
  },
  fuelType: {
    type: String,
    enum: ["essence", "diesel", "électrique", "hybride", "GPL", "autre"],
    default: "essence"
  },
  status: {
    type: String,
    enum: ["active", "maintenance", "inactive", "controle_technique", "visite_periodique"],
    default: "active"
  },
  features: [{
    type: String,
    trim: true
  }],
  mileage: {
    type: Number,
    default: 0,
    min: 0
  },
  lastMaintenanceDate: {
    type: Date
  },
  nextMaintenanceDate: {
    type: Date
  },
  nextMaintenanceKm: {
    type: Number,
    default: 0
  },
  // Contrôle technique
  controleTechnique: {
    dateDernier: {
      type: Date
    },
    dateProchain: {
      type: Date
    },
    statut: {
      type: String,
      enum: ["valide", "expire", "expire_soon", "pas_de_date"],
      default: "pas_de_date"
    },
    numeroControle: {
      type: String,
      trim: true
    },
    centreControle: {
      type: String,
      trim: true
    }
  },
  // Visite périodique
  visitePeriodique: {
    dateDerniere: {
      type: Date
    },
    dateProchaine: {
      type: Date
    },
    statut: {
      type: String,
      enum: ["valide", "expire", "expire_soon", "pas_de_date"],
      default: "pas_de_date"
    },
    numeroVisite: {
      type: String,
      trim: true
    },
    centreVisite: {
      type: String,
      trim: true
    }
  },
  // Géolocalisation
  location: {
    latitude: {
      type: Number,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180
    },
    lastUpdate: {
      type: Date,
      default: Date.now
    },
    isOnline: {
      type: Boolean,
      default: false
    },
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  maintenanceHistory: [maintenanceEntrySchema],
  active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

// Index pour recherche plus rapide
vehicleSchema.index({ registrationNumber: 1 });
vehicleSchema.index({ status: 1 });
vehicleSchema.index({ entrepriseId: 1, status: 1 });
vehicleSchema.index({ "location.latitude": 1, "location.longitude": 1 });
vehicleSchema.index({ "controleTechnique.dateProchain": 1 });
vehicleSchema.index({ "visitePeriodique.dateProchaine": 1 });

// Méthodes pour vérifier les dates d'expiration
vehicleSchema.methods.checkControleTechnique = function() {
  const now = new Date();
  const prochainControle = this.controleTechnique.dateProchain;
  
  if (!prochainControle) return "pas_de_date";
  
  const joursRestants = Math.ceil((prochainControle - now) / (1000 * 60 * 60 * 24));
  
  if (joursRestants < 0) return "expire";
  if (joursRestants <= 30) return "expire_soon";
  return "valide";
};

vehicleSchema.methods.checkVisitePeriodique = function() {
  const now = new Date();
  const prochaineVisite = this.visitePeriodique.dateProchaine;
  
  if (!prochaineVisite) return "pas_de_date";
  
  const joursRestants = Math.ceil((prochaineVisite - now) / (1000 * 60 * 60 * 24));
  
  if (joursRestants < 0) return "expire";
  if (joursRestants <= 30) return "expire_soon";
  return "valide";
};

// Middleware pour mettre à jour automatiquement les statuts
vehicleSchema.pre('save', function(next) {
  // Mettre à jour le statut du contrôle technique
  const controleStatus = this.checkControleTechnique();
  this.controleTechnique.statut = controleStatus;
  
  // Mettre à jour le statut de la visite périodique
  const visiteStatus = this.checkVisitePeriodique();
  this.visitePeriodique.statut = visiteStatus;
  
  // Mettre à jour le statut général du véhicule
  if (controleStatus === "expire" || visiteStatus === "expire") {
    this.status = "inactive";
  } else if (controleStatus === "expire_soon" || visiteStatus === "expire_soon") {
    this.status = "maintenance";
  }
  
  next();
});

module.exports = mongoose.model("Vehicle", vehicleSchema);