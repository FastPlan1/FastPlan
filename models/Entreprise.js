const mongoose = require("mongoose");

const entrepriseSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true,
    trim: true
  },
  adresse: {
    type: String,
    trim: true
  },
  telephone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  siret: {
    type: String,
    trim: true
  },
  active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

// Index pour améliorer les performances
entrepriseSchema.index({ nom: 1 });
entrepriseSchema.index({ active: 1 });

module.exports = mongoose.model("Entreprise", entrepriseSchema);