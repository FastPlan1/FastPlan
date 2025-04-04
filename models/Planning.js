const mongoose = require("mongoose");

const planningSchema = new mongoose.Schema({
    nom: { type: String, required: true },
    prenom: { type: String, required: true },
    depart: { type: String, required: true },
    arrive: { type: String, required: true },
    heure: { type: String, required: true },
    date: { type: String, required: true },
    description: { type: String, required: true },
    chauffeur: { type: String, required: true },
    statut: { type: String, default: "En attente" },
    pieceJointe: [{ type: String }], // ✅ ici c’est un tableau
    prix: { type: Number }
}, {
    timestamps: true
});

module.exports = mongoose.model("Planning", planningSchema);
