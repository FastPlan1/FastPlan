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

// ✅ Récupérer toutes les demandes d'une entreprise - AVEC LOGS DE DEBUG
router.get("/entreprise/:entrepriseId", async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    
    console.log("🔍 [DEBUG] Recherche réservations pour entrepriseId:", entrepriseId);
    
    if (!entrepriseId || entrepriseId === "undefined") {
      return res.status(400).json({ 
        error: "ID entreprise manquant",
        message: "L'ID de l'entreprise est requis"
      });
    }

    // Recherche des réservations avec logs détaillés
    const reservations = await Reservation.find({ entrepriseId }).sort({ createdAt: -1 });
    
    console.log(`📦 [DEBUG] ${reservations.length} réservations trouvées pour l'entreprise ${entrepriseId}`);
    
    if (reservations.length > 0) {
      console.log("📋 [DEBUG] Première réservation:", {
        id: reservations[0]._id,
        client: `${reservations[0].nom} ${reservations[0].prenom}`,
        entrepriseId: reservations[0].entrepriseId,
        statut: reservations[0].statut
      });
    }
    
    // 🔍 DEBUG: Compter toutes les réservations dans la base
    const totalReservations = await Reservation.countDocuments({});
    console.log(`🗂️ [DEBUG] Total réservations dans la base: ${totalReservations}`);
    
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

// 🆕 Générer lien unique pour les clients - AVEC LOGS DE DEBUG
router.post("/generer-lien/:entrepriseId", async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    
    console.log("🔗 [DEBUG] Génération lien pour entrepriseId:", entrepriseId);
    
    if (!entrepriseId) {
      return res.status(400).json({ 
        error: "ID entreprise manquant",
        message: "L'ID de l'entreprise est requis"
      });
    }

    const lienUnique = crypto.randomBytes(16).toString("hex");

    let entreprise;
    
    // Gérer les IDs temporaires ET les ObjectIds
    if (entrepriseId.startsWith('temp-')) {
      console.log("🏢 [DEBUG] ID temporaire détecté:", entrepriseId);
      
      // Pour les IDs temporaires, chercher d'abord s'il existe
      entreprise = await Entreprise.findOne({ tempId: entrepriseId });
      
      if (!entreprise) {
        // Créer une nouvelle entreprise avec l'ID temporaire
        entreprise = new Entreprise({
          tempId: entrepriseId,
          nom: "Entreprise temporaire",
          email: "temp@example.com", // Champ requis
          lienReservation: lienUnique,
          dateCreation: new Date()
        });
        await entreprise.save();
        console.log(`🆕 [DEBUG] Nouvelle entreprise temporaire créée:`, {
          _id: entreprise._id,
          tempId: entreprise.tempId,
          nom: entreprise.nom
        });
      } else {
        // Mettre à jour l'entreprise existante
        entreprise.lienReservation = lienUnique;
        await entreprise.save();
        console.log(`🔄 [DEBUG] Entreprise temporaire mise à jour:`, {
          _id: entreprise._id,
          tempId: entreprise.tempId,
          nom: entreprise.nom
        });
      }
    } else {
      console.log("🏢 [DEBUG] ObjectId normal détecté:", entrepriseId);
      
      // Pour les ObjectIds normaux
      try {
        entreprise = await Entreprise.findByIdAndUpdate(
          entrepriseId,
          { lienReservation: lienUnique },
          { new: true }
        );
      } catch (error) {
        return res.status(400).json({ 
          error: "ID entreprise invalide",
          message: "L'ID fourni n'est pas un ObjectId valide"
        });
      }
    }

    if (!entreprise) {
      return res.status(404).json({ 
        error: "Entreprise non trouvée",
        message: "L'entreprise demandée n'existe pas"
      });
    }

    console.log(`🔗 [DEBUG] Lien généré avec succès:`, {
      entrepriseId: entreprise._id,
      tempId: entreprise.tempId,
      nom: entreprise.nom,
      lien: lienUnique
    });

    res.status(200).json({
      message: "🔗 Lien généré avec succès !",
      lien: lienUnique,
      entrepriseNom: entreprise.nom || "Entreprise"
    });
  } catch (err) {
    console.error("❌ Erreur génération lien :", err);
    res.status(500).json({ 
      error: "Erreur serveur lors de la génération du lien.",
      message: err.message 
    });
  }
});

// 📌 Récupérer l'entreprise par lien unique - AVEC LOGS DE DEBUG
router.get("/client/:lienReservation", async (req, res) => {
  try {
    const { lienReservation } = req.params;

    console.log("🔍 [DEBUG] Recherche entreprise par lien:", lienReservation);

    const entreprise = await Entreprise.findOne({
      lienReservation: lienReservation,
    });

    if (!entreprise) {
      console.log("❌ [DEBUG] Aucune entreprise trouvée pour le lien:", lienReservation);
      return res.status(404).json({ 
        error: "Lien invalide.",
        message: "Ce lien de réservation n'existe pas ou a expiré"
      });
    }

    console.log(`🔍 [DEBUG] Entreprise trouvée:`, {
      _id: entreprise._id,
      tempId: entreprise.tempId,
      nom: entreprise.nom,
      lienReservation: entreprise.lienReservation
    });

    // Récupérer l'ID correct pour les réservations (tempId ou _id)
    const entrepriseIdForReservation = entreprise.tempId || entreprise._id.toString();
    
    console.log(`📋 [DEBUG] ID utilisé pour les réservations: ${entrepriseIdForReservation}`);

    // Retour d'une page HTML simple pour le client
    const htmlForm = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Réservation - ${entreprise.nom || 'Transport'}</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          max-width: 600px; 
          margin: 50px auto; 
          padding: 20px;
          background-color: #f8f9fa;
          line-height: 1.6;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #007bff;
          padding-bottom: 20px;
        }
        .header h1 {
          color: #007bff;
          margin: 0 0 10px 0;
        }
        .header h2 {
          color: #343a40;
          margin: 0 0 10px 0;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 600;
          color: #495057;
        }
        input, textarea {
          width: 100%;
          padding: 12px;
          border: 2px solid #dee2e6;
          border-radius: 8px;
          font-size: 16px;
          box-sizing: border-box;
          transition: border-color 0.3s ease;
        }
        input:focus, textarea:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 3px rgba(0,123,255,0.1);
        }
        .required { color: #dc3545; }
        .submit-btn {
          background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
          color: white;
          padding: 15px 30px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          margin-top: 20px;
          transition: transform 0.2s ease;
        }
        .submit-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,123,255,0.3);
        }
        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .success, .error {
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          display: none;
          font-weight: 500;
        }
        .success {
          background-color: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }
        .error {
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
        .loading {
          display: none;
          text-align: center;
          color: #007bff;
        }
        .form-row {
          display: flex;
          gap: 15px;
        }
        .form-row .form-group {
          flex: 1;
        }
        .debug-info {
          background: #f8f9fa;
          padding: 10px;
          border-radius: 5px;
          font-size: 12px;
          color: #666;
          margin-bottom: 20px;
        }
        @media (max-width: 600px) {
          .form-row {
            flex-direction: column;
            gap: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚗 Réservation de transport</h1>
          <h2>${entreprise.nom || 'Service de transport'}</h2>
          <p>Remplissez le formulaire ci-dessous pour faire votre demande de réservation</p>
        </div>

        <div class="debug-info">
          🔧 Debug Info: Entreprise ID = ${entrepriseIdForReservation}
        </div>

        <div id="successMessage" class="success">
          ✅ Votre demande de réservation a été envoyée avec succès ! Nous vous recontacterons rapidement.
        </div>

        <div id="errorMessage" class="error">
          ❌ Une erreur s'est produite. Veuillez réessayer.
        </div>

        <div id="loadingMessage" class="loading">
          ⏳ Envoi en cours...
        </div>

        <form id="reservationForm">
          <div class="form-row">
            <div class="form-group">
              <label for="nom">Nom <span class="required">*</span></label>
              <input type="text" id="nom" name="nom" required>
            </div>
            <div class="form-group">
              <label for="prenom">Prénom <span class="required">*</span></label>
              <input type="text" id="prenom" name="prenom" required>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="email">Email <span class="required">*</span></label>
              <input type="email" id="email" name="email" required>
            </div>
            <div class="form-group">
              <label for="telephone">Téléphone <span class="required">*</span></label>
              <input type="tel" id="telephone" name="telephone" required>
            </div>
          </div>

          <div class="form-group">
            <label for="depart">Lieu de départ <span class="required">*</span></label>
            <input type="text" id="depart" name="depart" required placeholder="Adresse de départ">
          </div>

          <div class="form-group">
            <label for="arrive">Lieu d'arrivée <span class="required">*</span></label>
            <input type="text" id="arrive" name="arrive" required placeholder="Adresse d'arrivée">
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="date">Date <span class="required">*</span></label>
              <input type="date" id="date" name="date" required>
            </div>
            <div class="form-group">
              <label for="heure">Heure <span class="required">*</span></label>
              <input type="time" id="heure" name="heure" required>
            </div>
          </div>

          <div class="form-group">
            <label for="description">Description (optionnel)</label>
            <textarea id="description" name="description" rows="3" placeholder="Informations supplémentaires (nombre de passagers, bagages, etc.)"></textarea>
          </div>

          <button type="submit" class="submit-btn">📩 Envoyer ma demande</button>
        </form>
      </div>

      <script>
        console.log("🔧 [CLIENT DEBUG] Entreprise ID qui sera envoyé:", "${entrepriseIdForReservation}");

        document.getElementById('reservationForm').addEventListener('submit', async function(e) {
          e.preventDefault();
          
          const submitBtn = this.querySelector('.submit-btn');
          const loadingMsg = document.getElementById('loadingMessage');
          const successMsg = document.getElementById('successMessage');
          const errorMsg = document.getElementById('errorMessage');
          
          // Masquer les messages
          successMsg.style.display = 'none';
          errorMsg.style.display = 'none';
          loadingMsg.style.display = 'block';
          submitBtn.disabled = true;
          
          const formData = new FormData(this);
          const data = Object.fromEntries(formData);
          data.entrepriseId = "${entrepriseIdForReservation}"; // Ajouter l'ID de l'entreprise
          
          console.log("🔧 [CLIENT DEBUG] Données envoyées:", data);
          
          try {
            const response = await fetch('/api/reservations/client/${lienReservation}', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(data)
            });
            
            loadingMsg.style.display = 'none';
            
            const responseData = await response.json();
            console.log("🔧 [CLIENT DEBUG] Réponse serveur:", responseData);
            
            if (response.ok) {
              successMsg.style.display = 'block';
              this.reset();
              successMsg.scrollIntoView({ behavior: 'smooth' });
            } else {
              throw new Error('Erreur lors de l\\'envoi: ' + responseData.message);
            }
          } catch (error) {
            console.error("❌ [CLIENT DEBUG] Erreur:", error);
            loadingMsg.style.display = 'none';
            errorMsg.style.display = 'block';
            errorMsg.innerHTML = "❌ Erreur: " + error.message;
            errorMsg.scrollIntoView({ behavior: 'smooth' });
          } finally {
            submitBtn.disabled = false;
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

// 📌 Soumission du formulaire client - AVEC LOGS DE DEBUG COMPLETS
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
    entrepriseId, // Récupéré du formulaire HTML
  } = req.body;

  console.log("📝 [DEBUG] Soumission formulaire client:", {
    lienReservation: req.params.lienReservation,
    client: `${nom} ${prenom}`,
    entrepriseId: entrepriseId,
    body: req.body
  });

  try {
    // Validation des champs obligatoires
    if (!nom || !prenom || !email || !telephone || !depart || !arrive || !date || !heure) {
      console.log("❌ [DEBUG] Champs manquants dans la soumission");
      return res.status(400).json({
        error: "Champs manquants",
        message: "Tous les champs obligatoires doivent être remplis."
      });
    }

    const entreprise = await Entreprise.findOne({
      lienReservation: req.params.lienReservation,
    });

    if (!entreprise) {
      console.log("❌ [DEBUG] Entreprise non trouvée pour le lien:", req.params.lienReservation);
      return res.status(404).json({ 
        error: "Lien invalide.",
        message: "Ce lien de réservation n'existe pas ou a expiré"
      });
    }

    console.log("🏢 [DEBUG] Entreprise trouvée pour la soumission:", {
      _id: entreprise._id,
      tempId: entreprise.tempId,
      nom: entreprise.nom
    });

    // Utiliser l'ID correct (tempId ou _id)
    const finalEntrepriseId = entrepriseId || entreprise.tempId || entreprise._id.toString();

    console.log("🔧 [DEBUG] ID final utilisé pour la réservation:", finalEntrepriseId);

    const reservation = new Reservation({
      entrepriseId: finalEntrepriseId,
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

    console.log(`✅ [DEBUG] Réservation créée avec succès:`, {
      _id: reservation._id,
      entrepriseId: reservation.entrepriseId,
      client: `${reservation.nom} ${reservation.prenom}`,
      statut: reservation.statut,
      createdAt: reservation.createdAt
    });

    // Vérifier que la réservation est bien dans la base
    const verificationReservation = await Reservation.findById(reservation._id);
    console.log("🔍 [DEBUG] Vérification réservation dans la base:", {
      found: !!verificationReservation,
      entrepriseId: verificationReservation?.entrepriseId
    });

    res.status(201).json({ 
      message: "✅ Demande envoyée avec succès !",
      reservationId: reservation._id,
      debug: {
        entrepriseId: finalEntrepriseId,
        savedReservation: {
          id: reservation._id,
          entrepriseId: reservation.entrepriseId
        }
      }
    });
  } catch (err) {
    console.error("❌ [DEBUG] Erreur soumission client :", err);
    res.status(500).json({ 
      error: "Erreur serveur",
      message: err.message 
    });
  }
});

// 🐛 Route de debug temporaire
router.get("/debug/all", async (req, res) => {
  try {
    const allReservations = await Reservation.find({}).sort({ createdAt: -1 });
    const allEntreprises = await Entreprise.find({});
    
    console.log("🐛 [DEBUG] Route debug appelée");
    
    res.json({
      timestamp: new Date().toISOString(),
      totalReservations: allReservations.length,
      totalEntreprises: allEntreprises.length,
      reservations: allReservations.map(r => ({
        _id: r._id,
        client: `${r.nom} ${r.prenom}`,
        entrepriseId: r.entrepriseId,
        statut: r.statut,
        createdAt: r.createdAt
      })),
      entreprises: allEntreprises.map(e => ({
        _id: e._id,
        tempId: e.tempId,
        nom: e.nom,
        lienReservation: e.lienReservation
      }))
    });
  } catch (err) {
    console.error("❌ [DEBUG] Erreur route debug:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;