const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const EmployeeCode = require("../models/codeInvitation");
const User         = require("../models/User");

const {
  authMiddleware,
  isPatron,
  isChauffeur,
  isAdminOrPatron,
} = require("../middleware/authMiddleware");

console.log("📡 Routes de employeeRoutes.js chargées !");

// Applique d'abord le JWT à *toutes* les routes
router.use(authMiddleware);

/**
 * Récupérer les employés d’un patron
 * GET /employees/by-patron/:id
 */
router.get("/by-patron/:id", isAdminOrPatron, async (req, res) => {
  try {
    const patronId = req.params.id;
    const employees = await User.find({ entrepriseId: patronId })
      .select("name email role");
    res.json(employees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * Mettre à jour le rôle d’un employé (chauffeur ↔ admin ↔ patron)
 * PUT /employees/:id
 */
router.put("/:id", isAdminOrPatron, async (req, res) => {
  const { role } = req.body;
  if (!["chauffeur", "admin", "patron"].includes(role)) {
    return res.status(400).json({ message: "Rôle invalide." });
  }
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé." });
    user.role = role;
    await user.save();
    res.json({ id: user._id, name: user.name, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur lors de la mise à jour du rôle." });
  }
});

/**
 * Codes d’invitation d’un patron
 * GET /employees/codes/by-patron/:id
 */
router.get("/codes/by-patron/:id", isAdminOrPatron, async (req, res) => {
  try {
    const codes = await EmployeeCode.find({ patron: req.params.id })
      .sort({ createdAt: -1 });
    res.json(codes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * Supprimer un code d’invitation
 * DELETE /employees/delete-code/:id
 */
router.delete("/delete-code/:id", isAdminOrPatron, async (req, res) => {
  try {
    const deleted = await EmployeeCode.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Code non trouvé." });
    res.json({ message: "Code supprimé avec succès." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur lors de la suppression." });
  }
});

/**
 * Générer un code d’invitation
 * POST /employees/generate-code
 */
router.post("/generate-code", isAdminOrPatron, async (req, res) => {
  const { patronId } = req.body;
  if (!patronId) return res.status(400).json({ message: "ID du patron requis." });
  try {
    await EmployeeCode.deleteMany({ patron: patronId });
    const code = uuidv4().slice(0, 6).toUpperCase();
    await new EmployeeCode({ code, used: false, patron: patronId }).save();
    res.status(201).json({ code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur lors de la génération." });
  }
});

/**
 * Vérifier un code d’invitation
 * POST /employees/verify-code
 */
router.post("/verify-code", isAdminOrPatron, async (req, res) => {
  try {
    const found = await EmployeeCode.findOne({ code: req.body.code, used: false });
    if (!found) {
      return res.status(400).json({ valid: false, message: "Code invalide ou utilisé." });
    }
    res.json({ valid: true, patronId: found.patron });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur lors de la vérification." });
  }
});

/**
 * Marquer un code comme utilisé
 * PUT /employees/use-code
 */
router.put("/use-code", isAdminOrPatron, async (req, res) => {
  try {
    const updated = await EmployeeCode.findOneAndUpdate(
      { code: req.body.code, used: false },
      { used: true },
      { new: true }
    );
    if (!updated) {
      return res.status(400).json({ message: "Code déjà utilisé ou inexistant." });
    }
    res.json({ message: "Code marqué comme utilisé." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur lors de l'utilisation." });
  }
});

/**
 * Récupérer tous les chauffeurs (+ patron s’il n’est pas déjà listé)
 * GET /employees/chauffeurs
 */
router.get("/chauffeurs", async (req, res) => {
  try {
    const chauffeurs = await User.find({ role: "chauffeur" }).select("name");
    const patron     = await User.findOne({ role: "patron" }).select("name");
    const list       = chauffeurs.map(c => ({ nom: c.name }));
    if (patron && !list.find(c => c.nom === patron.name)) {
      list.push({ nom: patron.name });
    }
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/**
 * Récupérer les positions GPS
 * GET /employees/locations
 */
router.get("/locations", async (req, res) => {
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
    console.error(err);
    res.status(500).json({ message: "Impossible de récupérer les positions" });
  }
});

/**
 * Permettre au chauffeur de poster sa position
 * POST /employees/location
 */
router.post("/location", isChauffeur, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return res
        .status(400)
        .json({ message: "latitude et longitude numériques requis." });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Chauffeur non trouvé." });
    user.latitude  = latitude;
    user.longitude = longitude;
    user.updatedAt = new Date();
    await user.save();
    res.json({ message: "Position mise à jour." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

module.exports = router;
