const express = require("express");
const router = express.Router();
const Reservation = require("../models/DemandeReservation");
const Planning = require("../models/Planning");
const Entreprise = require("../models/Entreprise");
const crypto = require("crypto");

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
    
    if (!entrepriseId || entrepriseId === "undefined") {
      return res.status(400).json({ 
        error: "ID entreprise manquant",
        message: "L'ID de l'entreprise est requis"
      });
    }

    const reservations = await Reservation.find({ entrepriseId }).sort({ createdAt: -1 });
    
    console.log(`📦 ${reservations.length} réservations trouvées pour l'entreprise ${entrepriseId}`);
    
    res.status(200).json(reservations);
  } catch (err) {
    console.error("❌ Erreur récupération réservations :", err);
    res.status(500).json({ 
      error: "Erreur serveur",
      message: err.message 
    });
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
      return res.status(404).json({ 
        error: "Réservation non trouvée.",
        message: "La réservation demandée n'existe pas"
      });
    }

    // Création automatique dans le planning
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
      entrepriseId: reservation.entrepriseId,
      telephone: reservation.telephone,
      email: reservation.email,
    });

    await newCourse.save();

    console.log(`✅ Réservation ${req.params.id} acceptée et ajoutée au planning`);

    res.status(200).json({
      message: "✅ Réservation acceptée et ajoutée au planning.",
      reservation,
    });
  } catch (err) {
    console.error("❌ Erreur acceptation réservation :", err);
    res.status(500).json({ 
      error: "Erreur serveur",
      message: err.message 
    });
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
      return res.status(404).json({ 
        error: "Réservation non trouvée.",
        message: "La réservation demandée n'existe pas"
      });
    }

    console.log(`❌ Réservation ${req.params.id} refusée`);

    res.status(200).json({ 
      message: "❌ Réservation refusée.", 
      reservation 
    });
  } catch (err) {
    console.error("❌ Erreur refus réservation :", err);
    res.status(500).json({ 
      error: "Erreur serveur",
      message: err.message 
    });
  }
});

// ✅ Supprimer une réservation
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Reservation.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ 
        error: "Réservation non trouvée.",
        message: "La réservation demandée n'existe pas"
      });
    }

    console.log(`🗑️ Réservation ${req.params.id} supprimée`);

    res.status(200).json({ message: "🗑️ Réservation supprimée." });
  } catch (err) {
    console.error("❌ Erreur suppression réservation :", err);
    res.status(500).json({ 
      error: "Erreur serveur",
      message: err.message 
    });
  }
});

// 🆕 Générer lien unique pour les clients (utilisé par le modal du frontend)
router.post("/generer-lien/:entrepriseId", async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    
    if (!entrepriseId) {
      return res.status(400).json({ 
        error: "ID entreprise manquant",
        message: "L'ID de l'entreprise est requis"
      });
    }

    // Génération d'un lien unique plus long pour plus de sécurité
    const lienUnique = crypto.randomBytes(16).toString("hex");

    const entreprise = await Entreprise.findByIdAndUpdate(
      entrepriseId,
      { lienReservation: lienUnique },
      { new: true }
    );

    if (!entreprise) {
      return res.status(404).json({ 
        error: "Entreprise non trouvée",
        message: "L'entreprise demandée n'existe pas"
      });
    }

    console.log(`🔗 Nouveau lien généré pour l'entreprise ${entreprise.nom}: ${lienUnique}`);

    res.status(200).json({
      message: "🔗 Lien généré avec succès !",
      lien: lienUnique,
      entrepriseNom: entreprise.nom
    });
  } catch (err) {
    console.error("❌ Erreur génération lien :", err);
    res.status(500).json({ 
      error: "Erreur serveur lors de la génération du lien.",
      message: err.message 
    });
  }
});

// 📌 Récupérer l'entreprise par lien unique (pour le formulaire client)
router.get("/client/:lienReservation", async (req, res) => {
  try {
    const { lienReservation } = req.params;

    const entreprise = await Entreprise.findOne({
      lienReservation: lienReservation,
    });

    if (!entreprise) {
      return res.status(404).json({ 
        error: "Lien invalide.",
        message: "Ce lien de réservation n'existe pas ou a expiré"
      });
    }

    console.log(`🔍 Lien de réservation valide pour ${entreprise.nom}`);

    // Retour d'une page HTML simple pour le client
    const htmlForm = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Réservation - ${entreprise.nom}</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          max-width: 600px; 
          margin: 50px auto; 
          padding: 20px;
          background-color: #f8f9fa;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
          color: #333;
        }
        input, textarea, select {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 16px;
          box-sizing: border-box;
        }
        .required { color: red; }
        .submit-btn {
          background-color: #007bff;
          color: white;
          padding: 15px 30px;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          width: 100%;
          margin-top: 20px;
        }
        .submit-btn:hover {
          background-color: #0056b3;
        }
        .success {
          background-color: #d4edda;
          color: #155724;
          padding: 15px;
          border-radius: 6px;
          margin: 20px 0;
          display: none;
        }
        .error {
          background-color: #f8d7da;
          color: #721c24;
          padding: 15px;
          border-radius: 6px;
          margin: 20px 0;
          display: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚗 Réservation de transport</h1>
          <h2>${entreprise.nom}</h2>
          <p>Remplissez le formulaire ci-dessous pour faire votre demande de réservation</p>
        </div>

        <div id="successMessage" class="success">
          ✅ Votre demande de réservation a été envoyée avec succès ! Nous vous recontacterons rapidement.
        </div>

        <div id="errorMessage" class="error">
          ❌ Une erreur s'est produite. Veuillez réessayer.
        </div>

        <form id="reservationForm">
          <div class="form-group">
            <label for="nom">Nom <span class="required">*</span></label>
            <input type="text" id="nom" name="nom" required>
          </div>

          <div class="form-group">
            <label for="prenom">Prénom <span class="required">*</span></label>
            <input type="text" id="prenom" name="prenom" required>
          </div>

          <div class="form-group">
            <label for="email">Email <span class="required">*</span></label>
            <input type="email" id="email" name="email" required>
          </div>

          <div class="form-group">
            <label for="telephone">Téléphone <span class="required">*</span></label>
            <input type="tel" id="telephone" name="telephone" required>
          </div>

          <div class="form-group">
            <label for="depart">Lieu de départ <span class="required">*</span></label>
            <input type="text" id="depart" name="depart" required>
          </div>

          <div class="form-group">
            <label for="arrive">Lieu d'arrivée <span class="required">*</span></label>
            <input type="text" id="arrive" name="arrive" required>
          </div>

          <div class="form-group">
            <label for="date">Date <span class="required">*</span></label>
            <input type="date" id="date" name="date" required>
          </div>

          <div class="form-group">
            <label for="heure">Heure <span class="required">*</span></label>
            <input type="time" id="heure" name="heure" required>
          </div>

          <div class="form-group">
            <label for="description">Description (optionnel)</label>
            <textarea id="description" name="description" rows="3" placeholder="Informations supplémentaires..."></textarea>
          </div>

          <button type="submit" class="submit-btn">📩 Envoyer ma demande</button>
        </form>
      </div>

      <script>
        document.getElementById('reservationForm').addEventListener('submit', async function(e) {
          e.preventDefault();
          
          const formData = new FormData(this);
          const data = Object.fromEntries(formData);
          
          try {
            const response = await fetch('/api/reservations/client/${lienReservation}', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(data)
            });
            
            if (response.ok) {
              document.getElementById('successMessage').style.display = 'block';
              document.getElementById('errorMessage').style.display = 'none';
              this.reset();
              // Scroll vers le message de succès
              document.getElementById('successMessage').scrollIntoView({ behavior: 'smooth' });
            } else {
              throw new Error('Erreur lors de l\'envoi');
            }
          } catch (error) {
            document.getElementById('errorMessage').style.display = 'block';
            document.getElementById('successMessage').style.display = 'none';
            document.getElementById('errorMessage').scrollIntoView({ behavior: 'smooth' });
          }
        });

        // Définir la date minimale à aujourd'hui
        document.getElementById('date').min = new Date().toISOString().split('T')[0];
      </script>
    </body>
    </html>
    `;

    res.send(htmlForm);
  } catch (err) {
    console.error("❌ Erreur récupération entreprise par lien :", err);
    res.status(500).json({ 
      error: "Erreur serveur",
      message: err.message 
    });
  }
});

// 📌 Soumission du formulaire client (via lien unique)
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
    // Validation des champs obligatoires
    if (!nom || !prenom || !email || !telephone || !depart || !arrive || !date || !heure) {
      return res.status(400).json({
        error: "Champs manquants",
        message: "Tous les champs obligatoires doivent être remplis."
      });
    }

    const entreprise = await Entreprise.findOne({
      lienReservation: req.params.lienReservation,
    });

    if (!entreprise) {
      return res.status(404).json({ 
        error: "Lien invalide.",
        message: "Ce lien de réservation n'existe pas ou a expiré"
      });
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

    console.log(`✅ Nouvelle demande de réservation reçue pour ${entreprise.nom}: ${nom} ${prenom}`);

    res.status(201).json({ 
      message: "✅ Demande envoyée avec succès !",
      reservationId: reservation._id
    });
  } catch (err) {
    console.error("❌ Erreur soumission client :", err);
    res.status(500).json({ 
      error: "Erreur serveur",
      message: err.message 
    });
  }
});

module.exports = router;