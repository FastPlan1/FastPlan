const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true,
    trim: true,
  },
  prenom: {
    type: String,
    required: true,
    trim: true,
  },
  adresse: {
    type: String,
    required: true,
    trim: true,
  },
  telephone: {
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
  caisseSociale: {
    type: String,
    default: '',
    trim: true,
  },
  carteVitale: {
    type: String,
    default: null, // Chemin du fichier
  },
  bonsTransport: {
    type: [String],
    default: [],
  },
  entrepriseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entreprise',
    required: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Client', clientSchema);
