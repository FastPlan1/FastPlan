const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Trip = require("../models/Trip"); // Assuming you have a Trip model
const Vehicle = require("../models/Vehicle"); // Assuming you have a Vehicle model

const {
  authMiddleware,
  isAdminOrPatron,
} = require("../middleware/authMiddleware");

console.log("📡 Routes de reportingRoutes.js chargées !");

// On applique le JWT à toutes les routes
router.use(authMiddleware);

/**
 * GET /api/reports/employee-activity/:patronId
 * Récupère l'activité des employés sur une période donnée
 */
router.get(
  "/employee-activity/:patronId",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const queryDateRange = {};
      
      if (startDate) {
        queryDateRange.$gte = new Date(startDate);
      }
      
      if (endDate) {
        queryDateRange.$lte = new Date(endDate);
      }
      
      // Trouver tous les employés de l'entreprise
      const employees = await User.find({ 
        entrepriseId: req.params.patronId,
        role: "chauffeur" 
      }).select("_id name");
      
      const employeeActivity = [];
      
      for (const employee of employees) {
        // Compter les trajets par employé
        const tripCount = await Trip.countDocuments({
          chauffeurId: employee._id,
          ...(Object.keys(queryDateRange).length > 0 ? { createdAt: queryDateRange } : {})
        });
        
        // Calculer la durée totale des trajets
        const trips = await Trip.find({
          chauffeurId: employee._id,
          completed: true,
          ...(Object.keys(queryDateRange).length > 0 ? { createdAt: queryDateRange } : {})
        });
        
        let totalDuration = 0;
        let totalDistance = 0;
        
        trips.forEach(trip => {
          if (trip.startTime && trip.endTime) {
            const duration = (new Date(trip.endTime) - new Date(trip.startTime)) / (1000 * 60); // en minutes
            totalDuration += duration;
          }
          if (trip.distance) {
            totalDistance += trip.distance;
          }
        });
        
        employeeActivity.push({
          id: employee._id,
          name: employee.name,
          tripCount,
          totalDuration: Math.round(totalDuration),
          averageDuration: tripCount > 0 ? Math.round(totalDuration / tripCount) : 0,
          totalDistance: Math.round(totalDistance * 10) / 10,
          averageDistance: tripCount > 0 ? Math.round((totalDistance / tripCount) * 10) / 10 : 0
        });
      }
      
      res.json(employeeActivity);
    } catch (err) {
      console.error("❌ Erreur récupération activité employés :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * GET /api/reports/fleet-status/:patronId
 * Récupère l'état de la flotte de véhicules
 */
router.get(
  "/fleet-status/:patronId",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const vehicles = await Vehicle.find({ entrepriseId: req.params.patronId });
      
      const fleetStatus = {
        total: vehicles.length,
        active: vehicles.filter(v => v.status === "active").length,
        maintenance: vehicles.filter(v => v.status === "maintenance").length,
        inactive: vehicles.filter(v => v.status === "inactive").length,
        byType: {}
      };
      
      // Regrouper par type de véhicule
      vehicles.forEach(vehicle => {
        if (!fleetStatus.byType[vehicle.type]) {
          fleetStatus.byType[vehicle.type] = {
            total: 0,
            active: 0,
            maintenance: 0,
            inactive: 0
          };
        }
        
        fleetStatus.byType[vehicle.type].total++;
        fleetStatus.byType[vehicle.type][vehicle.status]++;
      });
      
      res.json(fleetStatus);
    } catch (err) {
      console.error("❌ Erreur récupération état de la flotte :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * GET /api/reports/daily-activity/:patronId
 * Récupère l'activité quotidienne sur une période donnée
 */
router.get(
  "/daily-activity/:patronId",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
      const end = endDate ? new Date(endDate) : new Date();
      
      // Chercher tous les employés pour cette entreprise
      const employees = await User.find({
        entrepriseId: req.params.patronId,
        role: "chauffeur"
      }).select("_id");
      
      const employeeIds = employees.map(emp => emp._id);
      
      const tripsByDay = await Trip.aggregate([
        {
          $match: {
            chauffeurId: { $in: employeeIds },
            createdAt: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            totalDistance: { $sum: "$distance" },
            revenue: { $sum: "$price" }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);
      
      res.json(tripsByDay);
    } catch (err) {
      console.error("❌ Erreur récupération activité quotidienne :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * GET /api/reports/revenue/:patronId
 * Récupère les revenus sur une période donnée
 */
router.get(
  "/revenue/:patronId",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const { period } = req.query; // 'day', 'week', 'month', 'year'
      const now = new Date();
      let startDate;
      
      switch (period) {
        case 'day':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - now.getDay()));
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.setDate(now.getDate() - 30)); // 30 jours par défaut
      }
      
      // Chercher tous les employés pour cette entreprise
      const employees = await User.find({
        entrepriseId: req.params.patronId,
        role: "chauffeur"
      }).select("_id");
      
      const employeeIds = employees.map(emp => emp._id);
      
      const revenueData = await Trip.aggregate([
        {
          $match: {
            chauffeurId: { $in: employeeIds },
            createdAt: { $gte: startDate },
            completed: true
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$price" },
            tripCount: { $sum: 1 },
            averagePrice: { $avg: "$price" }
          }
        }
      ]);
      
      const result = revenueData.length > 0 ? {
        totalRevenue: revenueData[0].totalRevenue,
        tripCount: revenueData[0].tripCount,
        averagePrice: Math.round(revenueData[0].averagePrice * 100) / 100,
        period
      } : {
        totalRevenue: 0,
        tripCount: 0,
        averagePrice: 0,
        period
      };
      
      res.json(result);
    } catch (err) {
      console.error("❌ Erreur récupération des revenus :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

module.exports = router;