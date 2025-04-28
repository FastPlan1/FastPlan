// routes/employeeRoutes.js

const express = require("express");
const router  = express.Router();
const { v4: uuidv4 } = require("uuid");

const EmployeeCode = require("../models/codeInvitation");
const User         = require("../models/User");

const {
  authMiddleware,
  isChauffeur,
  isAdminOrPatron,
} = require("../middleware/authMiddleware");

console.log("📡 Routes de employeeRoutes.js chargées !");

// 1) On protège **toutes** les routes de ce router par JWT
router.use(authMiddleware);

/**
 * GET /api/employees/by-patron/:id
 * Récupère la liste des employés pour un patron donné
 */
router.get(
  "/by-patron/:id",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const patronsEmployees = await User.find({ entrepriseId: req.params.id })
        .select("name email role");
      res.json(patronsEmployees);
    } catch (err) {
      console.error("❌ Erreur récupération employés :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * PUT /api/employees/:id
 * Met à jour le rôle d’un employé
 */
router.put(
  "/:id",
  isAdminOrPatron,
  async (req, res) => {
    const { role } = req.body;
    if (!["chauffeur", "admin", "patron"].includes(role)) {
      return res.status(400).json({ message: "Rôle invalide." });
    }
    try {
      const u = await User.findById(req.params.id);
      if (!u) return res.status(404).json({ message: "Utilisateur non trouvé." });
      u.role = role;
      await u.save();
      res.json({ id: u._id, name: u.name, role: u.role });
    } catch (err) {
      console.error("❌ Erreur mise à jour rôle :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * GET /api/employees/codes/by-patron/:id
 * Liste les codes d’invitation d’un patron
 */
router.get(
  "/codes/by-patron/:id",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const codes = await EmployeeCode.find({ patron: req.params.id })
        .sort({ createdAt: -1 });
      res.json(codes);
    } catch (err) {
      console.error("❌ Erreur récupération codes :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * DELETE /api/employees/delete-code/:id
 * Supprime un code d’invitation
 */
router.delete(
  "/delete-code/:id",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const del = await EmployeeCode.findByIdAndDelete(req.params.id);
      if (!del) return res.status(404).json({ message: "Code non trouvé." });
      res.json({ message: "Code supprimé." });
    } catch (err) {
      console.error("❌ Erreur suppr. code :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * POST /api/employees/generate-code
 * Génère un nouveau code d’invitation pour un patron
 */
router.post(
  "/generate-code",
  isAdminOrPatron,
  async (req, res) => {
    const { patronId } = req.body;
    if (!patronId) {
      return res.status(400).json({ message: "ID du patron requis." });
    }
    try {
      await EmployeeCode.deleteMany({ patron: patronId });
      const code = uuidv4().slice(0, 6).toUpperCase();
      await new EmployeeCode({ code, used: false, patron: patronId }).save();
      res.status(201).json({ code });
    } catch (err) {
      console.error("❌ Erreur génération code :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * POST /api/employees/verify-code
 * Vérifie qu’un code soit encore valide
 */
router.post(
  "/verify-code",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const found = await EmployeeCode.findOne({ code: req.body.code, used: false });
      if (!found) {
        return res.status(400).json({ valid: false, message: "Code invalide ou utilisé." });
      }
      res.json({ valid: true, patronId: found.patron });
    } catch (err) {
      console.error("❌ Erreur vérif. code :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * PUT /api/employees/use-code
 * Marque un code comme utilisé
 */
router.put(
  "/use-code",
  isAdminOrPatron,
  async (req, res) => {
    try {
      const upd = await EmployeeCode.findOneAndUpdate(
        { code: req.body.code, used: false },
        { used: true },
        { new: true }
      );
      if (!upd) {
        return res.status(400).json({ message: "Code inexistant ou déjà utilisé." });
      }
      res.json({ message: "Code utilisé." });
    } catch (err) {
      console.error("❌ Erreur use-code :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * GET /api/employees/chauffeurs
 * Récupère tous les chauffeurs (et ajoute le patron s’il n’est pas dedans)
 */
router.get(
  "/chauffeurs",
  async (req, res) => {
    try {
      const chauffeurs = await User.find({ role: "chauffeur" }).select("name");
      const patron     = await User.findOne({ role: "patron" }).select("name");
      const list       = chauffeurs.map(c => ({ nom: c.name }));
      if (patron && !list.find(c => c.nom === patron.name)) {
        list.push({ nom: patron.name });
      }
      res.json(list);
    } catch (err) {
      console.error("❌ Erreur récupération chauffeurs :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * GET /api/employees/locations
 * Récupère toutes les positions GPS
 */
router.get(
  "/locations",
  async (req, res) => {
    try {
      const users = await User.find(
        { role: { $in: ["chauffeur", "patron"] } },
        "name latitude longitude updatedAt"
      );
      const locations = users
        .filter(u => u.latitude != null && u.longitude != null)
        .map(u => ({
          id:        u._id,
          name:      u.name,
          latitude:  u.latitude,
          longitude: u.longitude,
          updatedAt: u.updatedAt,
        }));
      res.json(locations);
    } catch (err) {
      console.error("❌ Erreur récupération positions :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * POST /api/employees/location
 * Le chauffeur envoie sa position
 */
router.post(
  "/location",
  isChauffeur,
  async (req, res) => {
    try {
      const { latitude, longitude } = req.body;
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        return res.status(400).json({ message: "latitude et longitude numériques requis." });
      }
      const u = await User.findById(req.user.id);
      if (!u) {
        return res.status(404).json({ message: "Chauffeur non trouvé." });
      }
      u.latitude  = latitude;
      u.longitude = longitude;
      u.updatedAt = new Date();
      await u.save();
      res.json({ message: "Position mise à jour." });
    } catch (err) {
      console.error("❌ Erreur mise à jour position :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

module.exports = router;
