const mongoose = require("mongoose");

const CourseSchema = new mongoose.Schema({
  nom: { type: String },
  prenom: { type: String },
  depart: { type: String, required: true },
  arrive: { type: String, required: true },
  heure: { type: String },
  date: { type: String },
  description: { type: String },
  caisseSociale: { type: String },
  chauffeur: { type: String }, // chaîne de caractères
  entrepriseId: { type: String },
  statut: {
    type: String,
    enum: ["En attente", "En cours", "Terminée"],
    default: "En attente",
  },
  color: { type: String, default: "#1a73e8" },
  fichiers: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Course", CourseSchema);
