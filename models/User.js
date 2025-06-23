// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["patron", "chauffeur"],
    default: "patron",
  },
  entrepriseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Entreprise",
    default: null,
  },
  // Nouveaux champs pour la vérification d'email
  emailVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
    default: undefined,
  },
  verificationTokenExpires: {
    type: Date,
    default: undefined,
  },
  // Nouveaux champs pour la réinitialisation du mot de passe
  resetPasswordToken: {
    type: String,
    default: undefined,
  },
  resetPasswordExpires: {
    type: Date,
    default: undefined,
  },
}, {
  timestamps: true,
});

// Index pour améliorer les performances
userSchema.index({ email: 1 });
userSchema.index({ verificationToken: 1 });
userSchema.index({ resetPasswordToken: 1 });

module.exports = mongoose.model("User", userSchema);