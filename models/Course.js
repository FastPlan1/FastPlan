const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
    chauffeur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    date: { type: Date, required: true },
    depart: { type: String, required: true },
    destination: { type: String, required: true },
    statut: { type: String, enum: ['En attente', 'En cours', 'Terminée'], default: 'En attente' },
    prix: { type: Number, required: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Course', CourseSchema);
