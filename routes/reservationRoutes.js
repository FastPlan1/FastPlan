const express = require("express");
const router = express.Router();
const Reservation = require("../models/DemandeReservation");
const Planning = require("../models/Planning");
const Entreprise = require("../models/Entreprise");
const crypto = require("crypto");
const mongoose = require("mongoose");

// ✅ Créer une nouvelle demande de réservation (client)
router.post("/", async (req, res) => {
  try {
    const {
      nom,
      prenom,
      email,
      telephone,
      depart,
      arrive,
      date,
      heure,
      description,
      entrepriseId,
    } = req.body;

    if (!nom || !prenom || !email || !telephone || !depart || !arrive || !date || !heure) {
      return res.status(400).json({
        error: "⚠️ Tous les champs obligatoires doivent être remplis.",
      });
    }

    const nouvelleReservation = new Reservation({
      nom,
      prenom,
      email,
      telephone,
      depart,
      arrive,
      date,
      heure,
      description,
      entrepriseId: entrepriseId || null,
    });

    await nouvelleReservation.save();
    res.status(201).json({ message: "✅ Réservation envoyée avec succès." });
  } catch (err) {
    console.error("❌ Erreur création réservation :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ Récupérer toutes les demandes d'une entreprise
router.get("/entreprise/:entrepriseId", async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    const reservations = await Reservation.find({ entrepriseId }).sort({ createdAt: -1 });
    res.status(200).json(reservations);
  } catch (err) {
    console.error("❌ Erreur récupération réservations :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ Accepter une réservation
router.put("/accepter/:id", async (req, res) => {
  try {
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { statut: "Acceptée" },
      { new: true }
    );

    if (!reservation) {
      return res.status(404).json({ error: "Réservation non trouvée." });
    }

    const newCourse = new Planning({
      nom: reservation.nom,
      prenom: reservation.prenom,
      depart: reservation.depart,
      arrive: reservation.arrive,
      date: reservation.date,
      heure: reservation.heure,
      description: reservation.description,
      statut: "En attente",
      chauffeur: "Patron", // ✅ Important pour affichage immédiat
      color: "#1a73e8",     // ✅ Couleur par défaut pour l’agenda
    });

    await newCourse.save();

    res.status(200).json({
      message: "✅ Réservation acceptée et ajoutée au planning.",
      reservation,
    });
  } catch (err) {
    console.error("❌ Erreur acceptation réservation :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ Refuser une réservation
router.put("/refuser/:id", async (req, res) => {
  try {
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { statut: "Refusée" },
      { new: true }
    );

    if (!reservation) {
      return res.status(404).json({ error: "Réservation non trouvée." });
    }

    res.status(200).json({ message: "❌ Réservation refusée.", reservation });
  } catch (err) {
    console.error("❌ Erreur refus réservation :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ Supprimer une réservation
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Reservation.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Réservation non trouvée." });
    }

    res.status(200).json({ message: "🗑️ Réservation supprimée." });
  } catch (err) {
    console.error("❌ Erreur suppression réservation :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 📌 Générer lien unique pour les clients
router.post("/generer-lien/:entrepriseId", async (req, res) => {
  try {
    const lienUnique = crypto.randomBytes(8).toString("hex");

    const entreprise = await Entreprise.findByIdAndUpdate(
      req.params.entrepriseId,
      { lienReservation: lienUnique },
      { new: true }
    );

    res.status(200).json({
      message: "🔗 Lien généré avec succès !",
      lien: lienUnique,
    });
  } catch (err) {
    console.error("❌ Erreur génération lien :", err);
    res.status(500).json({ error: "Erreur serveur lors de la génération du lien." });
  }
});

// 📌 Récupérer l'entreprise par lien unique
router.get("/client/:lienReservation", async (req, res) => {
  try {
    const entreprise = await Entreprise.findOne({
      lienReservation: req.params.lienReservation,
    });

    if (!entreprise) {
      return res.status(404).json({ error: "Lien invalide." });
    }

    res.status(200).json({
      entrepriseId: entreprise._id,
      entrepriseNom: entreprise.nom,
    });
  } catch (err) {
    console.error("❌ Erreur récupération entreprise par lien :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 📌 Soumission du formulaire client
router.post("/client/:lienReservation", async (req, res) => {
  const {
    nom,
    prenom,
    email,
    telephone,
    depart,
    arrive,
    date,
    heure,
    description,
  } = req.body;

  try {
    const entreprise = await Entreprise.findOne({
      lienReservation: req.params.lienReservation,
    });

    if (!entreprise) {
      return res.status(404).json({ error: "Lien invalide." });
    }

    const reservation = new Reservation({
      entrepriseId: entreprise._id,
      nom,
      prenom,
      email,
      telephone,
      depart,
      arrive,
      date,
      heure,
      description,
      statut: "En attente",
    });

    await reservation.save();
    res.status(201).json({ message: "✅ Demande envoyée avec succès !" });
  } catch (err) {
    console.error("❌ Erreur soumission client :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
