const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  adresse: { type: String, required: true },
  telephone: { type: String, required: true },
  email: { type: String, required: true, unique: true }, // Ajouté : adresse email unique
  carteVitale: { type: String, default: null }, // URL du fichier uploadé
  bonsTransport: [{ type: String, default: [] }], // URLs des fichiers uploadés
  entrepriseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entreprise', required: true },
}, {
  timestamps: true
});

module.exports = mongoose.model('Client', clientSchema);
