const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const Course = require("../models/Planning");

// Configuration de Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/courses");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, "courseFile-" + uniqueSuffix + extension);
  },
});

const upload = multer({ storage });

// ✅ Upload de fichier pour une course
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

// ✅ Route de test
router.get("/test", (req, res) => {
  res.send("Route de test OK");
});

// ✅ Récupération d'une course par ID (SANS .populate)
router.get("/:id", async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
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
