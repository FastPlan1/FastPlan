const express = require("express");
const router = express.Router();
const Entreprise = require("../models/Entreprise");
const crypto = require("crypto");

// ✅ Générer lien unique pour réservations client
router.post("/generer-lien/:idEntreprise", async (req, res) => {
  try {
    const lienUnique = crypto.randomBytes(8).toString('hex'); // Exemple : a1b2c3d4e5f6g7h8

    const entreprise = await Entreprise.findByIdAndUpdate(
      req.params.idEntreprise,
      { lienReservation: lienUnique },
      { new: true }
    );

    res.status(200).json({
      message: "Lien généré avec succès !",
      lien: lienUnique
    });
  } catch (err) {
    console.error("Erreur génération lien :", err);
    res.status(500).json({ error: "Erreur serveur lors de la génération du lien." });
  }
});

// ✅ Récupérer l'entreprise d'un patron via son userId
router.get("/by-user/:userId", async (req, res) => {
  try {
    const entreprise = await Entreprise.findOne({ patronId: req.params.userId });
    if (!entreprise) return res.status(404).json({ error: "Entreprise introuvable." });

    res.status(200).json({ entrepriseId: entreprise._id });
  } catch (err) {
    console.error("❌ Erreur récupération entreprise par userId :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


module.exports = router;

