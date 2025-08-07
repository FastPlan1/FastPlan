const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/authMiddleware");
const Vehicle = require("../models/Vehicle");
const multer = require("multer");
const path = require("path");

// Configuration multer pour les uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/vehicles/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Seules les images sont autorisées"), false);
    }
  },
});

// GET /api/vehicles - Récupérer tous les véhicules de l'entreprise
router.get("/", authMiddleware, async (req, res) => {
  try {
    const vehicles = await Vehicle.find({
      entrepriseId: req.user.entrepriseId,
      active: true,
    }).populate("assignedDriver", "nom prenom");

    res.status(200).json(vehicles);
  } catch (error) {
    console.error("❌ Erreur récupération véhicules:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /api/vehicles/with-location - Récupérer les véhicules avec géolocalisation
router.get("/with-location", authMiddleware, async (req, res) => {
  try {
    const vehicles = await Vehicle.find({
      entrepriseId: req.user.entrepriseId,
      active: true,
      "location.latitude": { $exists: true, $ne: null },
      "location.longitude": { $exists: true, $ne: null },
    }).populate("assignedDriver", "nom prenom");

    res.status(200).json(vehicles);
  } catch (error) {
    console.error("❌ Erreur récupération véhicules avec localisation:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /api/vehicles/expiring - Récupérer les véhicules avec contrôles/visites expirant bientôt
router.get("/expiring", authMiddleware, async (req, res) => {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const vehicles = await Vehicle.find({
      entrepriseId: req.user.entrepriseId,
      active: true,
      $or: [
        { "controleTechnique.dateProchain": { $lte: thirtyDaysFromNow } },
        { "visitePeriodique.dateProchaine": { $lte: thirtyDaysFromNow } },
      ],
    });

    res.status(200).json(vehicles);
  } catch (error) {
    console.error("❌ Erreur récupération véhicules expirant:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// POST /api/vehicles - Créer un nouveau véhicule
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      titre,
      registrationNumber,
      brand,
      model,
      type,
      year,
      seats,
      fuelType,
      features,
      mileage,
      controleTechnique,
      visitePeriodique,
    } = req.body;

    // Vérifier si la plaque d'immatriculation existe déjà
    const existingVehicle = await Vehicle.findOne({
      registrationNumber: registrationNumber.toUpperCase(),
    });

    if (existingVehicle) {
      return res.status(400).json({
        message: "❌ Un véhicule avec cette plaque d'immatriculation existe déjà",
      });
    }

    const vehicle = new Vehicle({
      entrepriseId: req.user.entrepriseId,
      titre,
      registrationNumber: registrationNumber.toUpperCase(),
      brand,
      model,
      type,
      year,
      seats,
      fuelType,
      features: features || [],
      mileage,
      controleTechnique: {
        dateDernier: controleTechnique?.dateDernier,
        dateProchain: controleTechnique?.dateProchain,
        numeroControle: controleTechnique?.numeroControle,
        centreControle: controleTechnique?.centreControle,
      },
      visitePeriodique: {
        dateDerniere: visitePeriodique?.dateDerniere,
        dateProchaine: visitePeriodique?.dateProchaine,
        numeroVisite: visitePeriodique?.numeroVisite,
        centreVisite: visitePeriodique?.centreVisite,
      },
      createdBy: req.user._id,
    });

    await vehicle.save();

    console.log("🚗 Nouveau véhicule créé:", vehicle.titre);
    res.status(201).json({
      message: "🚗 Véhicule créé avec succès",
      vehicle,
    });
  } catch (error) {
    console.error("❌ Erreur création véhicule:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la création du véhicule",
    });
  }
});

// PUT /api/vehicles/:id - Mettre à jour un véhicule
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const updateData = req.body;

    // Vérifier si la plaque d'immatriculation existe déjà (si elle est modifiée)
    if (updateData.registrationNumber) {
      const existingVehicle = await Vehicle.findOne({
        registrationNumber: updateData.registrationNumber.toUpperCase(),
        _id: { $ne: vehicleId },
      });

      if (existingVehicle) {
        return res.status(400).json({
          message: "❌ Un véhicule avec cette plaque d'immatriculation existe déjà",
        });
      }

      updateData.registrationNumber = updateData.registrationNumber.toUpperCase();
    }

    updateData.updatedBy = req.user._id;

    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: vehicleId, entrepriseId: req.user.entrepriseId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!vehicle) {
      return res.status(404).json({ message: "❌ Véhicule non trouvé" });
    }

    console.log("🔧 Véhicule mis à jour:", vehicle.titre);
    res.status(200).json({
      message: "🔧 Véhicule mis à jour avec succès",
      vehicle,
    });
  } catch (error) {
    console.error("❌ Erreur mise à jour véhicule:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour du véhicule",
    });
  }
});

// PUT /api/vehicles/:id/location - Mettre à jour la géolocalisation d'un véhicule
router.put("/:id/location", authMiddleware, async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const { latitude, longitude, isOnline, assignedDriver } = req.body;

    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      entrepriseId: req.user.entrepriseId,
    });

    if (!vehicle) {
      return res.status(404).json({ message: "❌ Véhicule non trouvé" });
    }

    const updateData = {
      "location.latitude": latitude,
      "location.longitude": longitude,
      "location.lastUpdate": new Date(),
      "location.isOnline": isOnline !== undefined ? isOnline : vehicle.location?.isOnline,
      updatedBy: req.user._id,
    };

    if (assignedDriver !== undefined) {
      updateData["location.assignedDriver"] = assignedDriver;
    }

    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      updateData,
      { new: true, runValidators: true }
    );

    console.log("📍 Géolocalisation mise à jour pour:", updatedVehicle.titre);
    res.status(200).json({
      message: "📍 Géolocalisation mise à jour",
      vehicle: updatedVehicle,
    });
  } catch (error) {
    console.error("❌ Erreur mise à jour géolocalisation:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour de la géolocalisation",
    });
  }
});

// PUT /api/vehicles/:id/controle-technique - Mettre à jour le contrôle technique
router.put("/:id/controle-technique", authMiddleware, async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const { dateDernier, dateProchain, numeroControle, centreControle } = req.body;

    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      entrepriseId: req.user.entrepriseId,
    });

    if (!vehicle) {
      return res.status(404).json({ message: "❌ Véhicule non trouvé" });
    }

    const updateData = {
      "controleTechnique.dateDernier": dateDernier,
      "controleTechnique.dateProchain": dateProchain,
      "controleTechnique.numeroControle": numeroControle,
      "controleTechnique.centreControle": centreControle,
      updatedBy: req.user._id,
    };

    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      updateData,
      { new: true, runValidators: true }
    );

    console.log("🔧 Contrôle technique mis à jour pour:", updatedVehicle.titre);
    res.status(200).json({
      message: "🔧 Contrôle technique mis à jour",
      vehicle: updatedVehicle,
    });
  } catch (error) {
    console.error("❌ Erreur mise à jour contrôle technique:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour du contrôle technique",
    });
  }
});

// PUT /api/vehicles/:id/visite-periodique - Mettre à jour la visite périodique
router.put("/:id/visite-periodique", authMiddleware, async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const { dateDerniere, dateProchaine, numeroVisite, centreVisite } = req.body;

    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      entrepriseId: req.user.entrepriseId,
    });

    if (!vehicle) {
      return res.status(404).json({ message: "❌ Véhicule non trouvé" });
    }

    const updateData = {
      "visitePeriodique.dateDerniere": dateDerniere,
      "visitePeriodique.dateProchaine": dateProchaine,
      "visitePeriodique.numeroVisite": numeroVisite,
      "visitePeriodique.centreVisite": centreVisite,
      updatedBy: req.user._id,
    };

    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      updateData,
      { new: true, runValidators: true }
    );

    console.log("🔧 Visite périodique mise à jour pour:", updatedVehicle.titre);
    res.status(200).json({
      message: "🔧 Visite périodique mise à jour",
      vehicle: updatedVehicle,
    });
  } catch (error) {
    console.error("❌ Erreur mise à jour visite périodique:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour de la visite périodique",
    });
  }
});

// DELETE /api/vehicles/:id - Supprimer un véhicule (soft delete)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const vehicleId = req.params.id;

    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      entrepriseId: req.user.entrepriseId,
    });

    if (!vehicle) {
      return res.status(404).json({ message: "❌ Véhicule non trouvé" });
    }

    vehicle.active = false;
    vehicle.updatedBy = req.user._id;
    await vehicle.save();

    console.log("🗑️ Véhicule supprimé:", vehicle.titre);
    res.status(200).json({
      message: "🗑️ Véhicule supprimé avec succès",
    });
  } catch (error) {
    console.error("❌ Erreur suppression véhicule:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la suppression du véhicule",
    });
  }
});

// GET /api/vehicles/:id - Récupérer un véhicule spécifique
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const vehicleId = req.params.id;

    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      entrepriseId: req.user.entrepriseId,
      active: true,
    }).populate("assignedDriver", "nom prenom");

    if (!vehicle) {
      return res.status(404).json({ message: "❌ Véhicule non trouvé" });
    }

    res.status(200).json(vehicle);
  } catch (error) {
    console.error("❌ Erreur récupération véhicule:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
