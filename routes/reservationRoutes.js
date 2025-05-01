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
    res.status(500).json({ error: err.message || "Erreur serveur" });
  }
});

// ✅ Récupérer toutes les demandes d'une entreprise
router.get("/entreprise/:entrepriseId", async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    
    // ✅ AJOUT: Vérification pour une valeur invalide
    if (!entrepriseId || entrepriseId === 'undefined') {
      return res.status(400).json({ error: "ID d'entreprise invalide" });
    }
    
    // ✅ MODIFIÉ: Pas de cast implicite vers ObjectId
    const reservations = await Reservation.find({ entrepriseId }).sort({ createdAt: -1 });
    res.status(200).json(reservations);
  } catch (err) {
    console.error("❌ Erreur récupération réservations :", err);
    res.status(500).json({ error: err.message || "Erreur serveur" });
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

    // ✅ MODIFIÉ: Vérification de l'entrepriseId avant création du Planning
    if (!reservation.entrepriseId) {
      return res.status(400).json({ error: "Cette réservation n'a pas d'ID d'entreprise associé." });
    }

    // ✅ MODIFIÉ: Création du Planning avec l'entrepriseId de la réservation
    const newCourse = new Planning({
      nom: reservation.nom,
      prenom: reservation.prenom,
      depart: reservation.depart,
      arrive: reservation.arrive,
      date: reservation.date,
      heure: reservation.heure,
      description: reservation.description,
      statut: "En attente",
      chauffeur: "Patron",
      color: "#1a73e8",
      entrepriseId: reservation.entrepriseId, // ✅ Ajout crucial de l'entrepriseId
      telephone: reservation.telephone || ""  // ✅ Ajout du téléphone s'il est disponible
    });

    await newCourse.save();

    res.status(200).json({
      message: "✅ Réservation acceptée et ajoutée au planning.",
      reservation,
      course: newCourse // ✅ AJOUT: Retourner la course créée pour information
    });
  } catch (err) {
    console.error("❌ Erreur acceptation réservation :", err);
    res.status(500).json({ error: err.message || "Erreur serveur" });
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
    res.status(500).json({ error: err.message || "Erreur serveur" });
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
    res.status(500).json({ error: err.message || "Erreur serveur" });
  }
});

// 📌 Générer lien unique pour les clients
router.post("/generer-lien/:entrepriseId", async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    
    // ✅ AJOUT: Vérification pour une valeur invalide
    if (!entrepriseId || entrepriseId === 'undefined') {
      return res.status(400).json({ error: "ID d'entreprise invalide" });
    }
    
    const lienUnique = crypto.randomBytes(8).toString("hex");

    // ✅ MODIFIÉ: Pas besoin de cast vers ObjectId pour un ID temp-*
    const entreprise = await Entreprise.findByIdAndUpdate(
      entrepriseId,
      { lienReservation: lienUnique },
      { new: true }
    );
    
    if (!entreprise) {
      return res.status(404).json({ error: "Entreprise non trouvée." });
    }

    res.status(200).json({
      message: "🔗 Lien généré avec succès !",
      lien: lienUnique,
    });
  } catch (err) {
    console.error("❌ Erreur génération lien :", err);
    res.status(500).json({ error: err.message || "Erreur serveur lors de la génération du lien." });
  }
});

// 📌 Récupérer l'entreprise par lien unique
router.get("/client/:lienReservation", async (req, res) => {
  try {
    const { lienReservation } = req.params;
    
    if (!lienReservation) {
      return res.status(400).json({ error: "Lien de réservation requis." });
    }
    
    const entreprise = await Entreprise.findOne({
      lienReservation: lienReservation,
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
    res.status(500).json({ error: err.message || "Erreur serveur" });
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
    const { lienReservation } = req.params;
    
    if (!lienReservation) {
      return res.status(400).json({ error: "Lien de réservation requis." });
    }
    
    // Validation des champs requis
    if (!nom || !prenom || !email || !telephone || !depart || !arrive || !date || !heure) {
      return res.status(400).json({
        error: "⚠️ Tous les champs marqués d'un astérisque sont obligatoires."
      });
    }

    const entreprise = await Entreprise.findOne({
      lienReservation: lienReservation,
    });

    if (!entreprise) {
      return res.status(404).json({ error: "Lien invalide." });
    }

    const reservation = new Reservation({
      entrepriseId: entreprise._id, // ✅ Utilisation de l'ID de l'entreprise trouvée
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
