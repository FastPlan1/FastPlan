const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const Vehicle = require("../models/Vehicle"); // Vous devrez créer ce modèle

const {
  authMiddleware,
  isAdminOrPatron,
} = require("../middleware/authMiddleware");

console.log("📡 Routes de vehicleRoutes.js chargées !");

// On applique le JWT à toutes les routes
router.use(authMiddleware);

/**
 * GET /api/vehicles/by-patron/:id
 * Récupère tous les véhicules d'un patron
 */
router.get(
  "/by-patron/:id",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const vehicles = await Vehicle.find({ entrepriseId: req.params.id })
        .sort({ createdAt: -1 });
      res.json(vehicles);
    } catch (err) {
      console.error("❌ Erreur récupération véhicules :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * GET /api/vehicles/:id
 * Récupère un véhicule par son ID
 */
router.get(
  "/:id",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const vehicle = await Vehicle.findById(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ message: "Véhicule non trouvé." });
      }
      res.json(vehicle);
    } catch (err) {
      console.error("❌ Erreur récupération véhicule :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * POST /api/vehicles
 * Crée un nouveau véhicule
 */
router.post(
  "/",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const {
        entrepriseId,
        registrationNumber,
        brand,
        model,
        type,
        year,
        seats,
        fuelType,
        status = "active",
        features = []
      } = req.body;
      
      if (!entrepriseId || !registrationNumber || !brand || !model || !type) {
        return res.status(400).json({
          message: "Veuillez fournir toutes les informations requises."
        });
      }
      
      // Vérifier si le numéro d'immatriculation existe déjà
      const existingVehicle = await Vehicle.findOne({
        registrationNumber: registrationNumber.toUpperCase()
      });
      
      if (existingVehicle) {
        return res.status(400).json({
          message: "Un véhicule avec ce numéro d'immatriculation existe déjà."
        });
      }
      
      const newVehicle = new Vehicle({
        entrepriseId,
        registrationNumber: registrationNumber.toUpperCase(),
        brand,
        model,
        type,
        year,
        seats,
        fuelType,
        status,
        features,
        createdBy: req.user.id
      });
      
      await newVehicle.save();
      res.status(201).json(newVehicle);
    } catch (err) {
      console.error("❌ Erreur création véhicule :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * PUT /api/vehicles/:id
 * Met à jour un véhicule existant
 */
router.put(
  "/:id",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const {
        registrationNumber,
        brand,
        model,
        type,
        year,
        seats,
        fuelType,
        status,
        features,
        maintenanceHistory,
        lastMaintenanceDate,
        nextMaintenanceDate
      } = req.body;
      
      const vehicle = await Vehicle.findById(req.params.id);
      
      if (!vehicle) {
        return res.status(404).json({ message: "Véhicule non trouvé." });
      }
      
      // Si le numéro d'immatriculation est modifié, vérifier qu'il n'existe pas déjà
      if (registrationNumber && 
          registrationNumber.toUpperCase() !== vehicle.registrationNumber) {
        const existingVehicle = await Vehicle.findOne({
          registrationNumber: registrationNumber.toUpperCase(),
          _id: { $ne: req.params.id }
        });
        
        if (existingVehicle) {
          return res.status(400).json({
            message: "Un véhicule avec ce numéro d'immatriculation existe déjà."
          });
        }
        
        vehicle.registrationNumber = registrationNumber.toUpperCase();
      }
      
      // Mise à jour des autres champs
      if (brand) vehicle.brand = brand;
      if (model) vehicle.model = model;
      if (type) vehicle.type = type;
      if (year) vehicle.year = year;
      if (seats) vehicle.seats = seats;
      if (fuelType) vehicle.fuelType = fuelType;
      if (status) vehicle.status = status;
      if (features) vehicle.features = features;
      if (maintenanceHistory) vehicle.maintenanceHistory = maintenanceHistory;
      if (lastMaintenanceDate) vehicle.lastMaintenanceDate = lastMaintenanceDate;
      if (nextMaintenanceDate) vehicle.nextMaintenanceDate = nextMaintenanceDate;
      
      vehicle.updatedAt = new Date();
      vehicle.updatedBy = req.user.id;
      
      await vehicle.save();
      res.json(vehicle);
    } catch (err) {
      console.error("❌ Erreur mise à jour véhicule :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * DELETE /api/vehicles/:id
 * Supprime un véhicule
 */
router.delete(
  "/:id",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const vehicle = await Vehicle.findById(req.params.id);
      
      if (!vehicle) {
        return res.status(404).json({ message: "Véhicule non trouvé." });
      }
      
      await Vehicle.findByIdAndDelete(req.params.id);
      res.json({ message: "Véhicule supprimé avec succès." });
    } catch (err) {
      console.error("❌ Erreur suppression véhicule :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * PATCH /api/vehicles/:id/status
 * Met à jour le statut d'un véhicule
 */
router.patch(
  "/:id/status",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const { status } = req.body;
      
      if (!["active", "maintenance", "inactive"].includes(status)) {
        return res.status(400).json({ message: "Statut invalide." });
      }
      
      const vehicle = await Vehicle.findById(req.params.id);
      
      if (!vehicle) {
        return res.status(404).json({ message: "Véhicule non trouvé." });
      }
      
      vehicle.status = status;
      vehicle.updatedAt = new Date();
      vehicle.updatedBy = req.user.id;
      
      // Si le statut est "maintenance", ajouter une entrée dans l'historique
      if (status === "maintenance") {
        if (!vehicle.maintenanceHistory) {
          vehicle.maintenanceHistory = [];
        }
        
        vehicle.maintenanceHistory.push({
          date: new Date(),
          type: "Maintenance programmée",
          notes: req.body.notes || "Mise en maintenance",
          performedBy: req.user.id
        });
        
        vehicle.lastMaintenanceDate = new Date();
      }
      
      await vehicle.save();
      res.json(vehicle);
    } catch (err) {
      console.error("❌ Erreur mise à jour statut véhicule :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * POST /api/vehicles/:id/maintenance
 * Ajoute une entrée de maintenance à un véhicule
 */
router.post(
  "/:id/maintenance",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const { type, notes, cost, nextMaintenanceKm, nextMaintenanceDate } = req.body;
      
      if (!type) {
        return res.status(400).json({
          message: "Veuillez fournir le type de maintenance."
        });
      }
      
      const vehicle = await Vehicle.findById(req.params.id);
      
      if (!vehicle) {
        return res.status(404).json({ message: "Véhicule non trouvé." });
      }
      
      if (!vehicle.maintenanceHistory) {
        vehicle.maintenanceHistory = [];
      }
      
      // Ajouter l'entrée de maintenance
      const maintenanceEntry = {
        date: new Date(),
        type,
        notes: notes || "",
        cost: cost || 0,
        performedBy: req.user.id
      };
      
      vehicle.maintenanceHistory.push(maintenanceEntry);
      vehicle.lastMaintenanceDate = new Date();
      
      // Mettre à jour la date de prochaine maintenance si fournie
      if (nextMaintenanceDate) {
        vehicle.nextMaintenanceDate = new Date(nextMaintenanceDate);
      }
      
      // Mettre à jour le kilométrage pour la prochaine maintenance si fourni
      if (nextMaintenanceKm) {
        vehicle.nextMaintenanceKm = nextMaintenanceKm;
      }
      
      await vehicle.save();
      res.status(201).json({
        message: "Entrée de maintenance ajoutée avec succès.",
        maintenanceEntry
      });
    } catch (err) {
      console.error("❌ Erreur ajout maintenance :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * GET /api/vehicles/available/:patronId
 * Récupère tous les véhicules disponibles (actifs)
 */
router.get(
  "/available/:patronId",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const vehicles = await Vehicle.find({
        entrepriseId: req.params.patronId,
        status: "active"
      }).select("_id registrationNumber brand model type seats");
      
      res.json(vehicles);
    } catch (err) {
      console.error("❌ Erreur récupération véhicules disponibles :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

module.exports = router;