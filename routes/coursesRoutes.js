const express = require('express');
const Course = require('../models/Course');
const { authMiddleware, isPatron, isChauffeur } = require('../middleware/authMiddleware');

const router = express.Router();

// ✅ 1. Récupérer toutes les courses (Patron uniquement)
router.get('/', authMiddleware, isPatron, async (req, res) => {
    try {
        const courses = await Course.find().populate('client chauffeur');
        res.status(200).json(courses);
    } catch (err) {
        console.error("❌ Erreur récupération des courses :", err);
        res.status(500).json({ error: err.message });
    }
});

// ✅ 2. Ajouter une course (Patron uniquement)
router.post('/', authMiddleware, isPatron, async (req, res) => {
    try {
        const { chauffeur, client, date, depart, destination, prix } = req.body;

        const newCourse = new Course({
            chauffeur, client, date, depart, destination, prix,
            statut: "En attente"
        });

        await newCourse.save();
        res.status(201).json({ message: "🚖 Course ajoutée avec succès", course: newCourse });
    } catch (err) {
        console.error("❌ Erreur ajout d'une course :", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
