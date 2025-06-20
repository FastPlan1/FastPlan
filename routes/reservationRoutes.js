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

// ✅ Récupérer toutes les demandes d'une entreprise - VERSION CORRIGÉE
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

    // 🔧 SOLUTION : Rechercher avec TOUS les IDs possibles
    let reservations = [];
    
    if (entrepriseId.startsWith('temp-')) {
      // Pour les IDs temporaires, chercher AUSSI par l'ObjectId de l'entreprise
      const entreprise = await Entreprise.findOne({ tempId: entrepriseId });
      
      if (entreprise) {
        console.log("🏢 [DEBUG] Entreprise trouvée:", {
          _id: entreprise._id,
          tempId: entreprise.tempId,
          nom: entreprise.nom
        });
        
        // Chercher les réservations avec TOUS les IDs possibles
        reservations = await Reservation.find({
          $or: [
            { entrepriseId: entrepriseId }, // ID temporaire
            { entrepriseId: entreprise._id.toString() }, // ObjectId en string
            { entrepriseId: entreprise._id } // ObjectId
          ]
        }).sort({ createdAt: -1 });
      } else {
        // Si pas d'entreprise trouvée, chercher quand même avec l'ID temporaire
        reservations = await Reservation.find({ entrepriseId }).sort({ createdAt: -1 });
      }
    } else {
      // Pour les ObjectIds normaux
      reservations = await Reservation.find({ entrepriseId }).sort({ createdAt: -1 });
    }
    
    console.log(`📦 [DEBUG] ${reservations.length} réservations trouvées pour l'entreprise ${entrepriseId}`);
    
    if (reservations.length > 0) {
      console.log("📋 [DEBUG] Exemples de réservations trouvées:", 
        reservations.slice(0, 2).map(r => ({
          id: r._id,
          client: `${r.nom} ${r.prenom}`,
          entrepriseId: r.entrepriseId,
          statut: r.statut
        }))
      );
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

// 🆕 Générer lien unique pour les clients - VERSION CORRIGÉE ANTI-DOUBLON
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
    
    // 🔧 VERSION CORRIGÉE : Gérer les IDs temporaires ET les ObjectIds
    if (entrepriseId.startsWith('temp-')) {
      console.log("🏢 [DEBUG] ID temporaire détecté:", entrepriseId);
      
      // Chercher d'abord s'il existe
      entreprise = await Entreprise.findOne({ tempId: entrepriseId });
      
      if (!entreprise) {
        // Créer une nouvelle entreprise SEULEMENT si elle n'existe pas
        try {
          entreprise = new Entreprise({
            tempId: entrepriseId,
            nom: "Mon Entreprise de Transport", // 🔧 Nom plus professionnel
            email: `contact-${Date.now()}@transport.com`, // 🔧 Email unique
            lienReservation: lienUnique,
            dateCreation: new Date()
          });
          await entreprise.save();
          console.log(`🆕 [DEBUG] Nouvelle entreprise temporaire créée:`, {
            _id: entreprise._id,
            tempId: entreprise.tempId,
            nom: entreprise.nom
          });
        } catch (saveError) {
          if (saveError.code === 11000) {
            // Si erreur de doublon, chercher l'entreprise existante
            console.log("🔄 [DEBUG] Doublon détecté, recherche de l'entreprise existante");
            entreprise = await Entreprise.findOne({ tempId: entrepriseId });
            if (entreprise) {
              entreprise.lienReservation = lienUnique;
              await entreprise.save();
              console.log("🔄 [DEBUG] Entreprise existante mise à jour");
            } else {
              throw new Error("Impossible de créer ou trouver l'entreprise");
            }
          } else {
            throw saveError;
          }
        }
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
      entrepriseNom: entreprise.nom || "Mon Entreprise"
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

    // Retour d'une page HTML moderne pour le client
    const htmlForm = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Réservation - ${entreprise.nom || 'Transport'}</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
          line-height: 1.6;
        }
        
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          position: relative;
          overflow: hidden;
        }
        
        .container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 5px;
          background: linear-gradient(90deg, #667eea, #764ba2);
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        
        .header h1 {
          color: #2d3748;
          font-size: 2.5rem;
          margin-bottom: 10px;
          font-weight: 700;
        }
        
        .header h2 {
          color: #667eea;
          font-size: 1.5rem;
          margin-bottom: 10px;
          font-weight: 600;
        }
        
        .header p {
          color: #718096;
          font-size: 1.1rem;
        }
        
        .form-group {
          margin-bottom: 25px;
        }
        
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #2d3748;
          font-size: 0.95rem;
        }
        
        .required { 
          color: #e53e3e; 
        }
        
        input, textarea {
          width: 100%;
          padding: 15px;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          font-size: 16px;
          transition: all 0.3s ease;
          background: #f7fafc;
        }
        
        input:focus, textarea:focus {
          outline: none;
          border-color: #667eea;
          background: white;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          transform: translateY(-2px);
        }
        
        .submit-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 18px 40px;
          border: none;
          border-radius: 50px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          margin-top: 30px;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        .submit-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        }
        
        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }
        
        .success, .error {
          padding: 20px;
          border-radius: 12px;
          margin: 25px 0;
          display: none;
          font-weight: 500;
          text-align: center;
        }
        
        .success {
          background: linear-gradient(135deg, #48bb78, #38a169);
          color: white;
          border: none;
        }
        
        .error {
          background: linear-gradient(135deg, #f56565, #e53e3e);
          color: white;
          border: none;
        }
        
        .loading {
          display: none;
          text-align: center;
          color: #667eea;
          font-weight: 600;
          font-size: 1.1rem;
        }
        
        .loading::after {
          content: '';
          display: inline-block;
          width: 20px;
          height: 20px;
          margin-left: 10px;
          border: 2px solid #667eea;
          border-radius: 50%;
          border-top-color: transparent;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          body {
            padding: 10px;
          }
          
          .container {
            padding: 25px;
          }
          
          .form-row {
            grid-template-columns: 1fr;
            gap: 0;
          }
          
          .header h1 {
            font-size: 2rem;
          }
          
          .header h2 {
            font-size: 1.3rem;
          }
        }
        
        .debug-info {
          background: #f7fafc;
          padding: 15px;
          border-radius: 8px;
          font-size: 12px;
          color: #718096;
          margin-bottom: 25px;
          border-left: 4px solid #667eea;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚗</h1>
          <h2>${entreprise.nom || 'Service de Transport'}</h2>
          <p>Remplissez le formulaire pour votre demande de réservation</p>
        </div>

        <div class="debug-info">
          🔧 Référence: ${entrepriseIdForReservation}
        </div>

        <div id="successMessage" class="success">
          ✅ Votre demande a été envoyée avec succès ! Nous vous recontacterons rapidement.
        </div>

        <div id="errorMessage" class="error">
          ❌ Une erreur s'est produite. Veuillez réessayer.
        </div>

        <div id="loadingMessage" class="loading">
          Envoi en cours...
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
            <label for="description">Informations complémentaires</label>
            <textarea id="description" name="description" rows="3" placeholder="Nombre de passagers, bagages, instructions spéciales..."></textarea>
          </div>

          <button type="submit" class="submit-btn">📩 Envoyer ma demande</button>
        </form>
      </div>

      <script>
        console.log("🔧 [CLIENT DEBUG] Entreprise ID:", "${entrepriseIdForReservation}");

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
          data.entrepriseId = "${entrepriseIdForReservation}";
          
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
            console.log("🔧 [CLIENT DEBUG] Réponse:", responseData);
            
            if (response.ok) {
              successMsg.style.display = 'block';
              this.reset();
              successMsg.scrollIntoView({ behavior: 'smooth' });
            } else {
              throw new Error(responseData.message || 'Erreur lors de l\\'envoi');
            }
          } catch (error) {
            console.error("❌ [CLIENT DEBUG] Erreur:", error);
            loadingMsg.style.display = 'none';
            errorMsg.style.display = 'block';
            errorMsg.innerHTML = "❌ " + error.message;
            errorMsg.scrollIntoView({ behavior: 'smooth' });
          } finally {
            submitBtn.disabled = false;
          }
        });

        // Date minimale = aujourd'hui
        document.getElementById('date').min = new Date().toISOString().split('T')[0];
        
        // Validation visuelle
        document.querySelectorAll('input[required]').forEach(input => {
          input.addEventListener('blur', function() {
            if (!this.value.trim()) {
              this.style.borderColor = '#e53e3e';
            } else {
              this.style.borderColor = '#48bb78';
            }
          });
        });
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

// 📌 Soumission du formulaire client - VERSION CORRIGÉE
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
    entrepriseId,
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

// 🧹 Route de nettoyage de la base de données (À SUPPRIMER après utilisation)
router.post("/admin/cleanup", async (req, res) => {
  try {
    console.log("🧹 [DEBUG] Démarrage nettoyage base de données");
    
    // Supprimer toutes les entreprises avec lienReservation null ou undefined
    const deletedEntreprises = await Entreprise.deleteMany({ 
      $or: [
        { lienReservation: null },
        { lienReservation: { $exists: false } }
      ]
    });
    
    // Supprimer les doublons d'entreprises temporaires
    const duplicateEntreprises = await Entreprise.aggregate([
      {
        $match: {
          tempId: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: "$tempId",
          count: { $sum: 1 },
          docs: { $push: "$_id" }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);
    
    let deletedDuplicates = 0;
    for (const group of duplicateEntreprises) {
      // Garder le premier, supprimer les autres
      const toDelete = group.docs.slice(1);
      await Entreprise.deleteMany({ _id: { $in: toDelete } });
      deletedDuplicates += toDelete.length;
    }
    
    console.log("🧹 [DEBUG] Nettoyage terminé:", {
      entreprisesAvecLienNull: deletedEntreprises.deletedCount,
      doublonsSupprimés: deletedDuplicates
    });
    
    res.json({
      message: "🧹 Nettoyage terminé avec succès",
      entreprisesAvecLienNull: deletedEntreprises.deletedCount,
      doublonsSupprimés: deletedDuplicates,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("❌ Erreur nettoyage:", err);
    res.status(500).json({ 
      error: "Erreur lors du nettoyage",
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
        lienReservation: e.lienReservation,
        email: e.email
      }))
    });
  } catch (err) {
    console.error("❌ [DEBUG] Erreur route debug:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;