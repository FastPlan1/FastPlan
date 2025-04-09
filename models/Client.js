const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  adresse: { type: String, required: true },
  telephone: { type: String, required: true },
  email: { type: String, required: true, unique: true }, // Adresse email unique
  caisseSociale: { type: String, default: '' }, // Champ optionnel (texte en une phrase)
  carteVitale: { type: String, default: null }, // URL du fichier uploadé pour la Carte Vitale
  bonsTransport: [{ type: String, default: [] }], // URLs des fichiers uploadés pour les Bons Transport
  entrepriseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entreprise', required: true },
}, {
  timestamps: true
});

module.exports = mongoose.model('Client', clientSchema);
