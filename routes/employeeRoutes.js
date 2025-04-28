// routes/employeeRoutes.js

const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const EmployeeCode = require("../models/codeInvitation");
const User         = require("../models/User");

// Middlewares
const {
  authMiddleware,
  isPatron,
  isChauffeur
} = require("../middleware/authMiddleware");

// ✅ Vérification du chargement du fichier
console.log("📡 Routes de employeeRoutes.js chargées !");

/**
 * ✅ Récupérer les employés d’un patron
 *  GET /employee/by-patron/:id
 */
router.get(
  "/by-patron/:id",
  authMiddleware,
  isPatron,
  async (req, res) => {
    try {
      const patronId = req.params.id;
      const employees = await User.find({ entrepriseId: patronId })
        .select("name email role");
      res.status(200).json(employees);
    } catch (err) {
      console.error("❌ Erreur récupération des employés :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * ✅ Mettre à jour le rôle d’un employé (chauffeur ↔ admin ↔ patron)
 *  PUT /employee/:id
 */
router.put(
  "/:id",
  authMiddleware,
  isPatron,
  async (req, res) => {
    const { id }   = req.params;
    const { role } = req.body;

    if (!["chauffeur", "admin", "patron"].includes(role)) {
      return res.status(400).json({ message: "Rôle invalide." });
    }

    try {
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé." });
      }
      user.role = role;
      await user.save();
      res.json({ id: user._id, name: user.name, role: user.role });
    } catch (err) {
      console.error("❌ Erreur mise à jour rôle :", err);
      res.status(500).json({ message: "Erreur serveur lors de la mise à jour du rôle." });
    }
  }
);

/**
 * ✅ Récupérer les codes d’invitation d’un patron
 *  GET /employee/codes/by-patron/:id
 */
router.get(
  "/codes/by-patron/:id",
  authMiddleware,
  isPatron,
  async (req, res) => {
    try {
      const patronId = req.params.id;
      const codes = await EmployeeCode.find({ patron: patronId }).sort({ createdAt: -1 });
      res.status(200).json(codes);
    } catch (err) {
      console.error("❌ Erreur récupération des codes :", err);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * ✅ Supprimer un code d’invitation
 *  DELETE /employee/delete-code/:id
 */
router.delete(
  "/delete-code/:id",
  authMiddleware,
  isPatron,
  async (req, res) => {
    try {
      const codeId = req.params.id;
      const deleted = await EmployeeCode.findByIdAndDelete(codeId);
      if (!deleted) {
        return res.status(404).json({ message: "Code non trouvé." });
      }
      res.status(200).json({ message: "Code supprimé avec succès." });
    } catch (err) {
      console.error("❌ Erreur suppression code :", err);
      res.status(500).json({ message: "Erreur serveur lors de la suppression du code." });
    }
  }
);

/**
 * ✅ Générer un code d’invitation
 *  POST /employee/generate-code
 */
router.post(
  "/generate-code",
  authMiddleware,
  isPatron,
  async (req, res) => {
    try {
      const { patronId } = req.body;
      if (!patronId) {
        return res.status(400).json({ message: "ID du patron requis." });
      }
      await EmployeeCode.deleteMany({ patron: patronId });
      const code = uuidv4().slice(0, 6).toUpperCase();
      const newCode = new EmployeeCode({ code, used: false, patron: patronId });
      await newCode.save();
      res.status(201).json({ code });
    } catch (err) {
      console.error("❌ Erreur génération code :", err);
      res.status(500).json({ message: "Erreur serveur lors de la génération du code." });
    }
  }
);

/**
 * ✅ Vérifier un code d’invitation
 *  POST /employee/verify-code
 */
router.post(
  "/verify-code",
  authMiddleware,
  isPatron,
  async (req, res) => {
    try {
      const { code } = req.body;
      const found = await EmployeeCode.findOne({ code, used: false });
      if (!found) {
        return res.status(400).json({ valid: false, message: "Code invalide ou déjà utilisé." });
      }
      res.status(200).json({ valid: true, patronId: found.patron });
    } catch (err) {
      console.error("❌ Erreur vérification code :", err);
      res.status(500).json({ message: "Erreur serveur lors de la vérification du code." });
    }
  }
);

/**
 * ✅ Marquer un code comme utilisé
 *  PUT /employee/use-code
 */
router.put(
  "/use-code",
  authMiddleware,
  isPatron,
  async (req, res) => {
    try {
      const { code } = req.body;
      const updated = await EmployeeCode.findOneAndUpdate(
        { code, used: false },
        { used: true },
        { new: true }
      );
      if (!updated) {
        return res.status(400).json({ message: "Code déjà utilisé ou inexistant." });
      }
      res.status(200).json({ message: "Code marqué comme utilisé." });
    } catch (err) {
      console.error("❌ Erreur lors de l'utilisation du code :", err);
      res.status(500).json({ message: "Erreur serveur lors de l'utilisation du code." });
    }
  }
);

/**
 * ✅ Récupérer tous les chauffeurs (auth requis)
 *  GET /employee/chauffeurs
 */
router.get(
  "/chauffeurs",
  authMiddleware,
  async (req, res) => {
    try {
      const chauffeurs = await User.find({ role: "chauffeur" }).select("name");
      const patron     = await User.findOne({ role: "patron" }).select("name");
      const result     = chauffeurs.map(c => ({ nom: c.name }));
      if (patron && !result.find(c => c.nom === patron.name)) {
        result.push({ nom: patron.name });
      }
      res.status(200).json(result);
    } catch (err) {
      console.error("❌ Erreur récupération des chauffeurs :", err.message);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/**
 * ✅ Récupérer positions GPS de tous les chauffeurs et patron (auth requis)
 *  GET /employee/locations
 */
router.get(
  "/locations",
  authMiddleware,
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
      res.status(200).json(locations);
    } catch (err) {
      console.error("❌ Erreur récupération positions :", err);
      res.status(500).json({ error: "Impossible de récupérer les positions" });
    }
  }
);

/**
 * ✅ Permettre aux chauffeurs d'envoyer leur position
 *  POST /employee/location
 */
router.post(
  "/location",
  authMiddleware,
  isChauffeur,
  async (req, res) => {
    try {
      const chauffeurId = req.user.id;
      const { latitude, longitude } = req.body;
      if (
        typeof latitude !== "number" ||
        typeof longitude !== "number"
      ) {
        return res
          .status(400)
          .json({ message: "latitude et longitude numériques requis." });
      }
      const user = await User.findById(chauffeurId);
      if (!user) {
        return res.status(404).json({ message: "Chauffeur non trouvé." });
      }
      user.latitude  = latitude;
      user.longitude = longitude;
      user.updatedAt = new Date();
      await user.save();
      res.json({ message: "Position mise à jour." });
    } catch (err) {
      console.error("❌ Erreur mise à jour position :", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

module.exports = router;
