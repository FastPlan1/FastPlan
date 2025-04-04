const mongoose = require("mongoose");

const EntrepriseSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  email: { type: String, required: true },
  lienReservation: { type: String, unique: true }, // ✅ Nouveau champ
  dateCreation: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Entreprise", EntrepriseSchema);

