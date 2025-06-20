const mongoose = require("mongoose");

const EntrepriseSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  email: { type: String, required: false },
  tempId: { type: String, unique: true, sparse: true },
  lienReservation: { type: String, unique: true, sparse: true },
  dateCreation: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Entreprise || mongoose.model("Entreprise", EntrepriseSchema);