const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const PromoCode = require("../models/PromoCode");
const Client = require("../models/Client");
const { authMiddleware, isAdminOrPatron } = require("../middleware/authMiddleware");

console.log("📡 Routes de promoCodeRoutes.js chargées !");

// Appliquer le middleware d'authentification
router.use(authMiddleware);

/**
 * GET /api/promocodes
 * Récupère tous les codes promo de l'entreprise
 */
router.get(
  "/",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const { active, expired, type } = req.query;
      
      const query = { entrepriseId: req.user.entrepriseId };
      
      // Filtrer par statut actif
      if (active !== undefined) {
        query.isActive = active === "true";
      }
      
      // Filtrer par expiration
      if (expired !== undefined) {
        const now = new Date();
        if (expired === "true") {
          query.validUntil = { $lt: now };
        } else {
          query.$or = [
            { validUntil: { $gt: now } },
            { validUntil: null }
          ];
        }
      }
      
      // Filtrer par type
      if (type) {
        query.type = type;
      }
      
      const promoCodes = await PromoCode.find(query)
        .sort({ createdAt: -1 })
        .populate("createdBy", "name");
      
      res.json(promoCodes);
    } catch (err) {
      console.error("❌ Erreur récupération codes promo:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * POST /api/promocodes
 * Crée un nouveau code promo
 */
router.post(
  "/",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const {
        code,
        type,
        value,
        maxValue,
        minOrderAmount,
        description,
        usageLimit,
        limitPerUser,
        validFrom,
        validUntil,
        forNewCustomersOnly,
        applicableVehicleTypes,
        excludedDays,
        excludedHours,
        firstRideOnly
      } = req.body;
      
      // Vérifier les champs obligatoires
      if (!code || !type || value === undefined) {
        return res.status(400).json({
          message: "Le code, le type et la valeur sont obligatoires"
        });
      }
      
      // Vérifier si le code existe déjà
      const existingCode = await PromoCode.findOne({
        code: code.toUpperCase()
      });
      
      if (existingCode) {
        return res.status(400).json({
          message: "Ce code promo existe déjà"
        });
      }
      
      // Créer le nouveau code promo
      const newPromoCode = new PromoCode({
        entrepriseId: req.user.entrepriseId,
        code: code.toUpperCase(),
        type,
        value,
        maxValue,
        minOrderAmount,
        description,
        usageLimit,
        limitPerUser,
        validFrom: validFrom ? new Date(validFrom) : undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        forNewCustomersOnly: forNewCustomersOnly || false,
        applicableVehicleTypes: applicableVehicleTypes || ['standard', 'premium', 'van', 'luxury'],
        excludedDays: excludedDays || [],
        excludedHours: excludedHours || [],
        firstRideOnly: firstRideOnly || false,
        createdBy: req.user.id
      });
      
      await newPromoCode.save();
      
      res.status(201).json(newPromoCode);
    } catch (err) {
      console.error("❌ Erreur création code promo:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * GET /api/promocodes/:id
 * Récupère les détails d'un code promo
 */
router.get(
  "/:id",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const promoCode = await PromoCode.findById(req.params.id)
        .populate("createdBy", "name")
        .populate("usedBy.userId", "name email")
        .populate("usedBy.clientId", "name email phone");
      
      if (!promoCode) {
        return res.status(404).json({ message: "Code promo non trouvé" });
      }
      
      // Vérifier que le code appartient à l'entreprise de l'utilisateur
      if (promoCode.entrepriseId.toString() !== req.user.entrepriseId.toString()) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }
      
      res.json(promoCode);
    } catch (err) {
      console.error("❌ Erreur récupération détails code promo:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * PUT /api/promocodes/:id
 * Met à jour un code promo
 */
router.put(
  "/:id",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const {
        value,
        maxValue,
        minOrderAmount,
        description,
        usageLimit,
        limitPerUser,
        validFrom,
        validUntil,
        isActive,
        forNewCustomersOnly,
        applicableVehicleTypes,
        excludedDays,
        excludedHours,
        firstRideOnly
      } = req.body;
      
      const promoCode = await PromoCode.findById(req.params.id);
      
      if (!promoCode) {
        return res.status(404).json({ message: "Code promo non trouvé" });
      }
      
      // Vérifier que le code appartient à l'entreprise de l'utilisateur
      if (promoCode.entrepriseId.toString() !== req.user.entrepriseId.toString()) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }
      
      // Mise à jour des champs
      if (value !== undefined) promoCode.value = value;
      if (maxValue !== undefined) promoCode.maxValue = maxValue;
      if (minOrderAmount !== undefined) promoCode.minOrderAmount = minOrderAmount;
      if (description !== undefined) promoCode.description = description;
      if (usageLimit !== undefined) promoCode.usageLimit = usageLimit;
      if (limitPerUser !== undefined) promoCode.limitPerUser = limitPerUser;
      if (validFrom !== undefined) promoCode.validFrom = validFrom ? new Date(validFrom) : undefined;
      if (validUntil !== undefined) promoCode.validUntil = validUntil ? new Date(validUntil) : undefined;
      if (isActive !== undefined) promoCode.isActive = isActive;
      if (forNewCustomersOnly !== undefined) promoCode.forNewCustomersOnly = forNewCustomersOnly;
      if (applicableVehicleTypes) promoCode.applicableVehicleTypes = applicableVehicleTypes;
      if (excludedDays) promoCode.excludedDays = excludedDays;
      if (excludedHours) promoCode.excludedHours = excludedHours;
      if (firstRideOnly !== undefined) promoCode.firstRideOnly = firstRideOnly;
      
      await promoCode.save();
      
      res.json(promoCode);
    } catch (err) {
      console.error("❌ Erreur mise à jour code promo:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * DELETE /api/promocodes/:id
 * Supprime un code promo
 */
router.delete(
  "/:id",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const promoCode = await PromoCode.findById(req.params.id);
      
      if (!promoCode) {
        return res.status(404).json({ message: "Code promo non trouvé" });
      }
      
      // Vérifier que le code appartient à l'entreprise de l'utilisateur
      if (promoCode.entrepriseId.toString() !== req.user.entrepriseId.toString()) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }
      
      await PromoCode.findByIdAndDelete(req.params.id);
      
      res.json({ message: "Code promo supprimé avec succès" });
    } catch (err) {
      console.error("❌ Erreur suppression code promo:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * POST /api/promocodes/verify
 * Vérifie la validité d'un code promo
 */
router.post(
  "/verify",
  async (req, res) => {
    try {
      const {
        code,
        amount,
        vehicleType,
        orderDate,
        clientId
      } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "Code promo requis" });
      }
      
      // Rechercher le code promo
      const promoCode = await PromoCode.findOne({
        code: code.toUpperCase(),
        entrepriseId: req.user.entrepriseId
      });
      
      if (!promoCode) {
        return res.status(404).json({
          valid: false,
          message: "Code promo invalide ou inexistant"
        });
      }
      
      // Préparer les données du client pour la vérification
      let client = null;
      if (clientId) {
        client = await Client.findById(clientId);
      }
      
      // Vérifier la validité du code
      const isValid = promoCode.isValid(
        req.user,
        client,
        amount || 0,
        vehicleType,
        orderDate ? new Date(orderDate) : undefined
      );
      
      if (!isValid) {
        return res.status(400).json({
          valid: false,
          message: "Ce code promo n'est pas applicable dans ce contexte"
        });
      }
      
      // Calculer la remise
      const discount = promoCode.calculateDiscount(amount || 0);
      
      res.json({
        valid: true,
        code: promoCode.code,
        type: promoCode.type,
        value: promoCode.value,
        discount,
        description: promoCode.description,
        validUntil: promoCode.validUntil
      });
    } catch (err) {
      console.error("❌ Erreur vérification code promo:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * POST /api/promocodes/apply
 * Applique un code promo et enregistre son utilisation
 */
router.post(
  "/apply",
  async (req, res) => {
    try {
      const {
        code,
        amount,
        vehicleType,
        orderDate,
        clientId,
        tripId
      } = req.body;
      
      if (!code || !amount) {
        return res.status(400).json({
          message: "Code promo et montant de la commande requis"
        });
      }
      
      // Rechercher le code promo
      const promoCode = await PromoCode.findOne({
        code: code.toUpperCase(),
        entrepriseId: req.user.entrepriseId
      });
      
      if (!promoCode) {
        return res.status(404).json({
          valid: false,
          message: "Code promo invalide ou inexistant"
        });
      }
      
      // Préparer les données du client pour la vérification
      let client = null;
      if (clientId) {
        client = await Client.findById(clientId);
      }
      
      // Vérifier la validité du code
      const isValid = promoCode.isValid(
        req.user,
        client,
        amount,
        vehicleType,
        orderDate ? new Date(orderDate) : undefined
      );
      
      if (!isValid) {
        return res.status(400).json({
          valid: false,
          message: "Ce code promo n'est pas applicable dans ce contexte"
        });
      }
      
      // Calculer la remise
      const discount = promoCode.calculateDiscount(amount);
      
      // Enregistrer l'utilisation du code
      await promoCode.recordUsage(req.user, client);
      
      // Si un ID de trajet est fourni, mettre à jour le trajet avec la remise
      if (tripId) {
        const Trip = require("../models/Trip");
        const trip = await Trip.findById(tripId);
        
        if (trip) {
          trip.promoCode = {
            code: promoCode.code,
            discount,
            appliedBy: req.user.id,
            appliedAt: new Date()
          };
          
          // Mettre à jour le prix avec la remise
          if (trip.price) {
            trip.originalPrice = trip.price;
            trip.price = Math.max(0, trip.price - discount);
          }
          
          await trip.save();
        }
      }
      
      res.json({
        success: true,
        code: promoCode.code,
        type: promoCode.type,
        value: promoCode.value,
        discount,
        description: promoCode.description,
        finalAmount: Math.max(0, amount - discount)
      });
    } catch (err) {
      console.error("❌ Erreur application code promo:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * GET /api/promocodes/stats
 * Récupère des statistiques sur l'utilisation des codes promo
 */
router.get(
  "/stats",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const { period } = req.query;
      const entrepriseId = req.user.entrepriseId;
      
      // Définir la date de début selon la période demandée
      let startDate = new Date();
      switch (period) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate.setMonth(startDate.getMonth() - 3); // 3 mois par défaut
      }
      
      // Récupérer tous les codes promo de l'entreprise
      const promoCodes = await PromoCode.find({ entrepriseId });
      
      // Agréger les statistiques
      const stats = {
        totalCodes: promoCodes.length,
        activeCodes: promoCodes.filter(code => code.isActive).length,
        expiredCodes: promoCodes.filter(code => {
          return code.validUntil && code.validUntil < new Date();
        }).length,
        totalUsage: promoCodes.reduce((sum, code) => sum + code.usageCount, 0),
        usageByType: {},
        topCodes: []
      };
      
      // Compter l'utilisation par type
      promoCodes.forEach(code => {
        if (!stats.usageByType[code.type]) {
          stats.usageByType[code.type] = 0;
        }
        stats.usageByType[code.type] += code.usageCount;
      });
      
      // Calculer les codes les plus utilisés
      const sortedCodes = [...promoCodes].sort((a, b) => b.usageCount - a.usageCount);
      stats.topCodes = sortedCodes.slice(0, 5).map(code => ({
        code: code.code,
        type: code.type,
        value: code.value,
        usageCount: code.usageCount,
        isActive: code.isActive
      }));
      
      // Récupérer les utilisations récentes (selon la période)
      const recentUsage = [];
      promoCodes.forEach(code => {
        code.usedBy.forEach(usage => {
          if (usage.lastUsed >= startDate) {
            recentUsage.push({
              code: code.code,
              type: code.type,
              value: code.value,
              usedAt: usage.lastUsed,
              usageCount: usage.usageCount
            });
          }
        });
      });
      
      // Trier les utilisations par date
      recentUsage.sort((a, b) => b.usedAt - a.usedAt);
      
      stats.recentUsage = recentUsage.slice(0, 10);
      
      res.json(stats);
    } catch (err) {
      console.error("❌ Erreur récupération statistiques codes promo:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * POST /api/promocodes/generate-batch
 * Génère un lot de codes promo
 */
router.post(
  "/generate-batch",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const {
        prefix,
        count,
        type,
        value,
        maxValue,
        minOrderAmount,
        description,
        usageLimit,
        limitPerUser,
        validFrom,
        validUntil,
        forNewCustomersOnly,
        applicableVehicleTypes,
        excludedDays,
        excludedHours,
        firstRideOnly
      } = req.body;
      
      // Vérifier les champs obligatoires
      if (!prefix || !count || !type || value === undefined) {
        return res.status(400).json({
          message: "Préfixe, nombre de codes, type et valeur sont obligatoires"
        });
      }
      
      // Limiter le nombre de codes à générer
      const codeCount = Math.min(100, Math.max(1, count));
      const createdCodes = [];
      
      // Générer les codes
      for (let i = 0; i < codeCount; i++) {
        // Générer un suffixe aléatoire de 6 caractères
        const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        const codeString = `${prefix}${suffix}`;
        
        // Vérifier si le code existe déjà
        const existingCode = await PromoCode.findOne({ code: codeString });
        if (existingCode) {
          // Si le code existe, réessayer
          i--;
          continue;
        }
        
        // Créer le nouveau code promo
        const newPromoCode = new PromoCode({
          entrepriseId: req.user.entrepriseId,
          code: codeString,
          type,
          value,
          maxValue,
          minOrderAmount,
          description,
          usageLimit,
          limitPerUser,
          validFrom: validFrom ? new Date(validFrom) : undefined,
          validUntil: validUntil ? new Date(validUntil) : undefined,
          forNewCustomersOnly: forNewCustomersOnly || false,
          applicableVehicleTypes: applicableVehicleTypes || ['standard', 'premium', 'van', 'luxury'],
          excludedDays: excludedDays || [],
          excludedHours: excludedHours || [],
          firstRideOnly: firstRideOnly || false,
          createdBy: req.user.id
        });
        
        await newPromoCode.save();
        createdCodes.push(newPromoCode);
      }
      
      res.status(201).json({
        message: `${createdCodes.length} codes promo générés avec succès`,
        codes: createdCodes
      });
    } catch (err) {
      console.error("❌ Erreur génération lot codes promo:", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

module.exports = router;