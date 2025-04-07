const mongoose = require("mongoose");

const planningSchema = new mongoose.Schema({
  entrepriseId: { type: String, required: true }, // ✅ Rattache chaque course à une entreprise
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  depart: { type: String, required: true },
  arrive: { type: String, required: true },
  heure: { type: String, required: true },
  date: { type: String, required: true },
  description: { type: String, default: "" },
  chauffeur: { type: String, default: "non attribué" },
  statut: { type: String, default: "En attente" },
  pieceJointe: [{ type: String }],
  prix: { type: Number, default: null }
}, {
  timestamps: true
});

module.exports = mongoose.model("Planning", planningSchema);
