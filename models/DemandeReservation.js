const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema({
    nom: { type: String, required: true },
    prenom: { type: String, required: true },
    email: { type: String, required: true },
    telephone: { type: String, required: true },
    depart: { type: String, required: true },
    arrive: { type: String, required: true },
    date: { type: String, required: true },
    heure: { type: String, required: true },
    description: { type: String, required: false },
    statut: { type: String, default: "En attente" },
    entrepriseId: { type: String, required: false }, // 👈 Doit être String, pas ObjectId
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Reservation || mongoose.model("Reservation", ReservationSchema);