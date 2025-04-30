const express = require("express");
const router = express.Router();
const priceEstimator = require("../utils/priceEstimator");
const Entreprise = require("../models/Entreprise");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

const {
  authMiddleware,
  isAdminOrPatron
} = require("../middleware/authMiddleware");

console.log("📡 Routes de priceRoutes.js chargées !");

// Appliquer le middleware d'authentification
router.use(authMiddleware);

/**
 * POST /api/price/estimate
 * Estime le prix d'une course
 */
router.post(
  "/estimate",
  async (req, res) => {
    try {
      const {
        entrepriseId,
        origin,
        destination,
        stops,
        date,
        vehicleType,
        passengers,
        luggageCount,
        withPet,
        isAirport,
        waitingTime,
        promoCode
      } = req.body;
      
      // Vérifier les données requises
      if (!origin || !destination) {
        return res.status(400).json({
          message: "Les points de départ et d'arrivée sont requis"
        });
      }
      
      // Utiliser l'entreprise de l'utilisateur si non spécifiée
      const useEntrepriseId = entrepriseId || req.user.entrepriseId;
      
      // Convertir la date si nécessaire
      const useDate = date ? new Date(date) : new Date();
      
      // Préparer les paramètres
      const params = {
        entrepriseId: useEntrepriseId,
        origin,
        destination,
        stops,
        date: useDate,
        vehicleType,
        passengers,
        luggageCount,
        withPet,
        isAirport,
        waitingTime,
        promoCode
      };
      
      // Obtenir l'estimation
      const estimate = await priceEstimator.estimatePrice(params);
      
      res.json(estimate);
    } catch (err) {
      console.error("❌ Erreur estimation de prix:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * POST /api/price/generate-quote
 * Génère un devis PDF pour une course
 */
router.post(
  "/generate-quote",
  async (req, res) => {
    try {
      const {
        estimation,
        clientInfo,
        title,
        validUntil,
        notes
      } = req.body;
      
      if (!estimation || !clientInfo) {
        return res.status(400).json({
          message: "L'estimation et les informations client sont requises"
        });
      }
      
      // Récupérer les informations de l'entreprise
      const entreprise = await Entreprise.findById(req.user.entrepriseId)
        .select("name address phone email logo tarifSettings");
      
      if (!entreprise) {
        return res.status(404).json({ message: "Entreprise non trouvée" });
      }
      
      // Créer un document PDF
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });
      
      // Définir le nom du fichier
      const quoteNumber = Date.now().toString();
      const filename = `devis_${quoteNumber}.pdf`;
      const filePath = path.join(__dirname, '..', 'temp', filename);
      
      // S'assurer que le dossier temp existe
      if (!fs.existsSync(path.join(__dirname, '..', 'temp'))) {
        fs.mkdirSync(path.join(__dirname, '..', 'temp'), { recursive: true });
      }
      
      // Flux de sortie
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      
      // Ajouter le logo de l'entreprise si disponible
      if (entreprise.logo) {
        doc.image(entreprise.logo, 50, 50, { width: 150 });
      }
      
      // Titre du devis
      doc.fontSize(20).text(title || "DEVIS", { align: 'center' });
      doc.moveDown();
      
      // Informations de l'entreprise
      doc.fontSize(12).text('INFORMATIONS ENTREPRISE', { underline: true });
      doc.fontSize(10).text(`${entreprise.name}`);
      doc.text(`${entreprise.address || 'Adresse non spécifiée'}`);
      doc.text(`Tél: ${entreprise.phone || 'Non spécifié'}`);
      doc.text(`Email: ${entreprise.email || 'Non spécifié'}`);
      doc.moveDown();
      
      // Informations du client
      doc.fontSize(12).text('INFORMATIONS CLIENT', { underline: true });
      doc.fontSize(10).text(`Nom: ${clientInfo.name || 'Non spécifié'}`);
      doc.text(`Adresse: ${clientInfo.address || 'Non spécifiée'}`);
      doc.text(`Tél: ${clientInfo.phone || 'Non spécifié'}`);
      doc.text(`Email: ${clientInfo.email || 'Non spécifié'}`);
      doc.moveDown();
      
      // Détails de la course
      doc.fontSize(12).text('DÉTAILS DE LA COURSE', { underline: true });
      doc.fontSize(10).text(`De: ${estimation.route.legs[0].startAddress}`);
      doc.text(`À: ${estimation.route.legs[estimation.route.legs.length - 1].endAddress}`);
      
      // Ajouter les arrêts si présents
      if (estimation.route.legs.length > 1) {
        doc.text('Arrêts:');
        for (let i = 1; i < estimation.route.legs.length; i++) {
          doc.text(`  - ${estimation.route.legs[i].startAddress}`);
        }
      }
      
      doc.text(`Distance: ${estimation.route.distance.toFixed(2)} km`);
      doc.text(`Durée estimée: ${estimation.route.duration.toFixed(0)} minutes`);
      doc.moveDown();
      
      // Détails du prix
      doc.fontSize(12).text('DÉTAILS DU PRIX', { underline: true });
      doc.fontSize(10).text(`Prix de base: ${estimation.basePrice.toFixed(2)} €`);
      doc.text(`Prix distance (${estimation.route.distance.toFixed(2)} km): ${estimation.distancePrice.toFixed(2)} €`);
      doc.text(`Prix durée (${estimation.route.duration.toFixed(0)} min): ${estimation.durationPrice.toFixed(2)} €`);
      
      // Suppléments
      if (Object.keys(estimation.surcharges).length > 0) {
        doc.moveDown(0.5);
        doc.text('Suppléments:');
        for (const [key, surcharge] of Object.entries(estimation.surchargeDetails)) {
          if (surcharge.amount) {
            doc.text(`  - ${surcharge.label}: ${surcharge.amount.toFixed(2)} €`);
          } else if (surcharge.factor) {
            doc.text(`  - ${surcharge.label}: facteur ${surcharge.factor.toFixed(2)}`);
          }
        }
      }
      
      // Remises
      if (estimation.discount > 0) {
        doc.moveDown(0.5);
        doc.text('Remises:');
        doc.text(`  - ${estimation.discountDetails.label || 'Remise'}: -${estimation.discount.toFixed(2)} €`);
      }
      
      // Prix total
      doc.moveDown();
      doc.fontSize(14).text(`PRIX TOTAL: ${estimation.totalPrice.toFixed(2)} €`, { bold: true });
      
      // Validité
      const validityDate = validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      doc.moveDown();
      doc.fontSize(10).text(`Ce devis est valable jusqu'au ${validityDate.toLocaleDateString()}.`);
      
      // Notes
      if (notes) {
        doc.moveDown();
        doc.text('Notes:');
        doc.text(notes);
      }
      
      // Pied de page
      doc.fontSize(8);
      doc.text(
        `Devis n° ${quoteNumber} généré le ${new Date().toLocaleDateString()} par Fast Plan.`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );
      
      // Finaliser le document
      doc.end();
      
      // Attendre que le fichier soit écrit
      stream.on('finish', () => {
        // Envoyer le fichier
        res.download(filePath, filename, (err) => {
          if (err) {
            console.error("❌ Erreur envoi du fichier:", err);
            return res.status(500).json({ message: "Erreur lors de l'envoi du fichier" });
          }
          
          // Supprimer le fichier après envoi
          fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) {
              console.error("❌ Erreur suppression du fichier temporaire:", unlinkErr);
            }
          });
        });
      });
    } catch (err) {
      console.error("❌ Erreur génération devis:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * GET /api/price/settings
 * Récupère les paramètres de tarification
 */
router.get(
  "/settings",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const entreprise = await Entreprise.findById(req.user.entrepriseId)
        .select("tarifSettings");
      
      if (!entreprise) {
        return res.status(404).json({ message: "Entreprise non trouvée" });
      }
      
      // Si aucun paramètre de tarification n'est défini, utiliser les valeurs par défaut
      const settings = entreprise.tarifSettings || priceEstimator.defaultRates;
      
      res.json(settings);
    } catch (err) {
      console.error("❌ Erreur récupération paramètres de tarification:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * PUT /api/price/settings
 * Met à jour les paramètres de tarification
 */
router.put(
  "/settings",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const settings = req.body;
      
      // Valider les paramètres requis
      const requiredFields = ['basePrice', 'pricePerKm', 'pricePerMinute', 'minimumPrice'];
      for (const field of requiredFields) {
        if (settings[field] === undefined || settings[field] <= 0) {
          return res.status(400).json({
            message: `Le champ ${field} est requis et doit être positif`
          });
        }
      }
      
      // Mettre à jour l'entreprise
      const entreprise = await Entreprise.findById(req.user.entrepriseId);
      
      if (!entreprise) {
        return res.status(404).json({ message: "Entreprise non trouvée" });
      }
      
      entreprise.tarifSettings = {
        ...priceEstimator.defaultRates,
        ...settings
      };
      
      await entreprise.save();
      
      res.json(entreprise.tarifSettings);
    } catch (err) {
      console.error("❌ Erreur mise à jour paramètres de tarification:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * GET /api/price/promo-codes
 * Récupère les codes promo disponibles
 */
router.get(
  "/promo-codes",
  isAdminOrPatron,
  async (req, res) => {
    try {
      // TODO: Implémenter la récupération des codes promo depuis la base de données
      // Pour le moment, renvoyer un message temporaire
      res.json([
        {
          code: "WELCOME",
          type: "percentage",
          value: 10,
          label: "Code de bienvenue (10%)",
          isActive: true,
          validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        }
      ]);
    } catch (err) {
      console.error("❌ Erreur récupération codes promo:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

module.exports = router;