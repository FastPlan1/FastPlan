const mongoose = require("mongoose");

const EntrepriseSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  email: { type: String, required: true },
  // 🆕 Champ ajouté pour gérer les IDs temporaires (comme temp-xxx)
  tempId: { 
    type: String, 
    unique: true, 
    sparse: true // Permet des valeurs null sans conflit
  },
  lienReservation: { type: String, unique: true },
  dateCreation: { type: Date, default: Date.now }
});

// 🔧 CORRECTION pour éviter l'erreur de réécriture
module.exports = mongoose.models.Entreprise || mongoose.model("Entreprise", EntrepriseSchema);