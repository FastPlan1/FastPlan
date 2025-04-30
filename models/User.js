const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, "Format d'email invalide"]
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["chauffeur", "admin", "patron", "client"],
    required: true
  },
  phone: {
    type: String,
    trim: true
  },
  entrepriseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Entreprise"
  },
  permissions: {
    canAccessClients: {
      type: Boolean,
      default: false
    },
    canManageVehicles: {
      type: Boolean,
      default: false
    },
    canViewReports: {
      type: Boolean,
      default: false
    },
    canEditPlanning: {
      type: Boolean,
      default: false
    },
    canModifyPrices: {
      type: Boolean,
      default: false
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  profilePic: {
    type: String
  },
  // Pour la géolocalisation
  latitude: {
    type: Number
  },
  longitude: {
    type: Number
  },
  lastLocationUpdate: {
    type: Date
  },
  // Informations spécifiques au chauffeur
  driverInfo: {
    licenseNumber: {
      type: String,
      trim: true
    },
    licenseExpiry: {
      type: Date
    },
    preferredVehicles: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle"
    }],
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    totalTrips: {
      type: Number,
      default: 0
    },
    availability: {
      status: {
        type: String,
        enum: ["available", "busy", "offline"],
        default: "available"
      },
      workingHours: {
        monday: { start: String, end: String },
        tuesday: { start: String, end: String },
        wednesday: { start: String, end: String },
        thursday: { start: String, end: String },
        friday: { start: String, end: String },
        saturday: { start: String, end: String },
        sunday: { start: String, end: String }
      }
    }
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, { timestamps: true });

// Middleware pour mettre à jour la date de dernière connexion
userSchema.pre("save", function(next) {
  if (this.isNew) {
    // Attribuer des permissions par défaut en fonction du rôle
    if (this.role === "patron") {
      this.permissions = {
        canAccessClients: true,
        canManageVehicles: true,
        canViewReports: true,
        canEditPlanning: true,
        canModifyPrices: true
      };
    } else if (this.role === "admin") {
      this.permissions = {
        canAccessClients: true,
        canManageVehicles: true,
        canViewReports: true,
        canEditPlanning: true,
        canModifyPrices: false
      };
    } else if (this.role === "chauffeur") {
      this.permissions = {
        canAccessClients: false,
        canManageVehicles: false,
        canViewReports: false,
        canEditPlanning: false,
        canModifyPrices: false
      };
    }
  }
  next();
});

// Méthode pour mettre à jour la date de dernière connexion
userSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  return this.save();
};

// Méthode pour vérifier si un utilisateur a une permission spécifique
userSchema.methods.hasPermission = function(permission) {
  return this.permissions && this.permissions[permission] === true;
};

// Méthode pour savoir si l'utilisateur appartient à une entreprise
userSchema.methods.belongsToEntreprise = function(entrepriseId) {
  return this.entrepriseId && this.entrepriseId.toString() === entrepriseId.toString();
};

module.exports = mongoose.model("User", userSchema);