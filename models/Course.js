const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  depart: { type: String, required: true },
  arrive: { type: String, required: true },
  heure: { type: String, required: true },
  date: { type: String, required: true },
  description: { type: String },
  caisseSociale: { type: String },
  chauffeur: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // ✅ pour le populate
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' }, // ✅ manquait ici
  entrepriseId: { type: String },
  statut: {
    type: String,
    enum: ["En attente", "En cours", "Terminée"],
    default: "En attente",
  },
  color: { type: String, default: "#1a73e8" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Course", CourseSchema);
