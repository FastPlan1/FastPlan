const mongoose = require("mongoose");

const EntrepriseSchema = new mongoose.Schema({
  nom: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: false 
  },
  telephone: { 
    type: String, 
    default: "" 
  },
  adresse: { 
    type: String, 
    default: "" 
  },
  patronId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  tempId: { 
    type: String, 
    sparse: true  // Retiré unique: true
  },
  lienReservation: { 
    type: String, 
    sparse: true  // Retiré unique: true pour éviter les erreurs
  },
  dateCreation: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.models.Entreprise || mongoose.model("Entreprise", EntrepriseSchema);