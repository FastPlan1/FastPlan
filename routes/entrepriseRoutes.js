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

module.exports = router;

