const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const Course = require("../models/Course");

// Configure Multer pour stocker les fichiers uploadés dans le dossier "uploads/courses"
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/courses");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, "courseFile-" + uniqueSuffix + extension);
  }
});

const upload = multer({ storage });

// Route pour uploader un fichier pour une course
// Assurez-vous que votre modèle Course contient un champ "fichiers" de type [String]
router.post("/upload/:id", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier envoyé." });
    }
    const filePath = `/uploads/courses/${req.file.filename}`;
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course non trouvée." });
    }
    // Si le champ "fichiers" n'existe pas, on le crée.
    if (!course.fichiers) {
      course.fichiers = [];
    }
    course.fichiers.push(filePath);
    await course.save();
    res.status(200).json({ message: "Fichier uploadé avec succès", course });
  } catch (err) {
    console.error("Erreur upload fichier :", err);
    res.status(500).json({ error: "Erreur serveur lors de l'upload du fichier." });
  }
});

// Route pour récupérer une course avec ses détails
router.get("/:id", async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate("chauffeur", "name email")
      .populate("client", "name email");
    if (!course) {
      return res.status(404).json({ message: "Course non trouvée." });
    }
    res.status(200).json(course);
  } catch (err) {
    console.error("Erreur récupération course :", err);
    res.status(500).json({ error: "Erreur serveur lors de la récupération de la course." });
  }
});

module.exports = router;
