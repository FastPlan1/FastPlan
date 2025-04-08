const express = require("express");
const router = express.Router();
const Planning = require("../models/Planning");
const multer = require("multer");
const path = require("path");

// 📦 Multer pour fichiers joints
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `piece-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

/* ----------------- ✅ ROUTES ------------------- */

// ✅ Ajouter une course
router.post("/", async (req, res) => {
  try {
    const { nom, prenom, depart, arrive, heure, description, date, chauffeur, entrepriseId } = req.body;

    if (!nom || !prenom || !depart || !arrive || !heure || !description || !date || !entrepriseId) {
      return res.status(400).json({ error: "⚠️ Tous les champs requis doivent être remplis." });
    }

    const newCourse = new Planning({
      entrepriseId,
      nom,
      prenom,
      depart,
      arrive,
      heure,
      description,
      date,
      chauffeur: chauffeur || "Patron",
      statut: "En attente",
    });

    await newCourse.save();
    res.status(201).json({ message: "✅ Course ajoutée avec succès", course: newCourse });
  } catch (err) {
    console.error("❌ Erreur ajout course :", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Récupérer toutes les courses d’une entreprise
router.get("/", async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    if (!entrepriseId) return res.status(400).json({ error: "❌ entrepriseId requis" });

    const courses = await Planning.find({ entrepriseId }).sort({ date: 1, heure: 1 });
    res.status(200).json(courses);
  } catch (err) {
    console.error("❌ Erreur récupération planning :", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Récupérer le planning d’un chauffeur dans son entreprise
router.get("/chauffeur/:chauffeurNom", async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const chauffeurNom = decodeURIComponent(req.params.chauffeurNom);

    if (!entrepriseId) return res.status(400).json({ error: "❌ entrepriseId requis" });

    const courses = await Planning.find({
      entrepriseId,
      chauffeur: { $regex: new RegExp(`^${chauffeurNom}$`, "i") },
    }).sort({ date: 1, heure: 1 });

    res.status(200).json(courses);
  } catch (err) {
    console.error("❌ Erreur récupération planning chauffeur :", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Envoyer une course à un chauffeur
router.put("/send/:id", async (req, res) => {
  try {
    const { chauffeur, color } = req.body;
    if (!chauffeur) return res.status(400).json({ error: "⚠️ Le chauffeur doit être spécifié." });

    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      { chauffeur, statut: "Attribuée", ...(color && { color }) },
      { new: true }
    );

    if (!updatedCourse) return res.status(404).json({ message: "❌ Course non trouvée." });

    res.status(200).json({ message: "🚖 Course envoyée !", course: updatedCourse });
  } catch (err) {
    console.error("❌ Erreur envoi au chauffeur :", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Modifier uniquement la couleur
router.put("/color/:id", async (req, res) => {
  const { color } = req.body;
  console.log("🎨 Requête reçue pour changement de couleur :", req.params.id, color); // 👈

  try {
    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      { color },
      { new: true }
    );
    if (!updatedCourse) return res.status(404).json({ message: "❌ Course non trouvée." });
    res.status(200).json({ message: "🎨 Couleur mise à jour", course: updatedCourse });
  } catch (err) {
    console.error("❌ Erreur mise à jour couleur :", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Marquer une course comme terminée
router.put("/finish/:id", async (req, res) => {
  try {
    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      { statut: "Terminée" },
      { new: true }
    );

    if (!updatedCourse) return res.status(404).json({ message: "❌ Course non trouvée." });

    console.log(`🔔 ALERTE : Course terminée par ${updatedCourse.chauffeur}`);
    res.status(200).json({ message: "✅ Course terminée", course: updatedCourse });
  } catch (err) {
    console.error("❌ Erreur fin de course :", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Récupérer les courses terminées d’une entreprise
router.get("/terminees", async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    if (!entrepriseId) return res.status(400).json({ error: "❌ entrepriseId requis" });

    const courses = await Planning.find({ statut: "Terminée", entrepriseId }).sort({ date: -1, heure: -1 });
    res.status(200).json(courses);
  } catch (err) {
    console.error("❌ Erreur récupération historique :", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Modifier le prix d'une course
router.put("/price/:id", async (req, res) => {
  try {
    const { prix } = req.body;
    const updated = await Planning.findByIdAndUpdate(req.params.id, { prix }, { new: true });
    if (!updated) return res.status(404).json({ message: "❌ Course non trouvée." });

    res.status(200).json({ message: "💰 Prix mis à jour", course: updated });
  } catch (err) {
    console.error("❌ Erreur mise à jour prix :", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Supprimer une course
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Planning.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "❌ Course non trouvée." });

    res.status(200).json({ message: "🗑️ Course supprimée", course: deleted });
  } catch (err) {
    console.error("❌ Erreur suppression course :", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Upload de pièce jointe
router.post("/upload/:id", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier envoyé." });

    const filePath = `/uploads/${req.file.filename}`;
    const course = await Planning.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "❌ Course non trouvée." });

    course.pieceJointe = Array.isArray(course.pieceJointe)
      ? [...course.pieceJointe, filePath]
      : [filePath];

    await course.save();
    res.status(200).json({ message: "📎 Fichier attaché avec succès", course });
  } catch (err) {
    console.error("❌ Erreur upload fichier :", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
