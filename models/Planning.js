const mongoose = require("mongoose");

const planningSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  depart: { type: String, required: true },
  arrive: { type: String, required: true },
  heure: { type: String, required: true },
  date: { type: String, required: true },
  description: { type: String, default: "" }, // ✅ facultatif dans les réservations
  chauffeur: { type: String, default: "non attribué" }, // ✅ valeur par défaut pour les réservations client
  statut: { type: String, default: "En attente" }, // En attente, Terminée...
  pieceJointe: [{ type: String }], // ✅ fichiers associés (PDF, etc.)
  prix: { type: Number, default: null } // ✅ peut être défini après
}, {
  timestamps: true // ✅ ajoute createdAt et updatedAt automatiquement
});

module.exports = mongoose.model("Planning", planningSchema);
