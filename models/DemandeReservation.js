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
    statut: { type: String, default: "En attente" }, // En attente, Acceptée, Refusée
    entrepriseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entreprise', required: false }, // 🔧 optionnel
    createdAt: { type: Date, default: Date.now } // ✅ virgule fixée au-dessus
});

module.exports = mongoose.model("Reservation", ReservationSchema);
