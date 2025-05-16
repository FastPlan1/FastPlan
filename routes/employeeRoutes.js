// routes/employeeRoutes.js
const express        = require("express");
const router         = express.Router();
const { v4: uuidv4 } = require("uuid");

const EmployeeCode = require("../models/codeInvitation");
const User         = require("../models/User");

const {
  authMiddleware,
  isChauffeur,
  isAdminOrPatron,
} = require("../middleware/authMiddleware");

// ──────────────────────────────────────────────────────────
//  INIT
// ──────────────────────────────────────────────────────────
console.log("📡 [EMP] employeeRoutes initialisées");

// Applique le JWT sur tout le sous-routeur
router.use(authMiddleware);

// ──────────────────────────────────────────────────────────
//  GET /api/employees/by-patron/:id
// ──────────────────────────────────────────────────────────
router.get("/by-patron/:id", isAdminOrPatron, async (req, res) => {
  console.log(`🟡 [EMP] GET by-patron — patronId=${req.params.id}`);
  try {
    const employees = await User.find({
      entrepriseId: req.params.id,
      role: { $in: ["chauffeur", "admin"] },   // exclut le patron
    }).select("name email role");

    console.log(`✅ [EMP] ${employees.length} employé(s) envoyé(s)`);
    res.json(employees);
  } catch (err) {
    console.error("❌ [EMP] Erreur récupération employés :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ──────────────────────────────────────────────────────────
//  PUT /api/employees/:id  (changer de rôle)
// ──────────────────────────────────────────────────────────
router.put("/:id", isAdminOrPatron, async (req, res) => {
  const { role } = req.body;
  console.log("🟡 [EMP] PUT change-role");
  console.log("    ├─ params.id :", req.params.id);
  console.log("    └─ body      :", req.body);

  if (!["chauffeur", "admin", "patron"].includes(role)) {
    console.warn("⚠️  [EMP] Rôle invalide reçu :", role);
    return res.status(400).json({ message: "Rôle invalide." });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      console.warn("⚠️  [EMP] Utilisateur non trouvé :", req.params.id);
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    console.log(
      `🔄 [EMP] Rôle ${user.role} → ${role} pour ${user.name} (${user._id})`
    );
    user.role = role;
    await user.save();

    res.json({ id: user._id, name: user.name, role: user.role });
  } catch (err) {
    console.error("❌ [EMP] Erreur mise à jour rôle :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ──────────────────────────────────────────────────────────
//  GET /api/employees/codes/by-patron/:id
// ──────────────────────────────────────────────────────────
router.get("/codes/by-patron/:id", isAdminOrPatron, async (req, res) => {
  console.log(`🟡 [EMP] GET codes — patronId=${req.params.id}`);
  try {
    const codes = await EmployeeCode.find({ patron: req.params.id }).sort({ createdAt: -1 });
    console.log(`✅ [EMP] ${codes.length} code(s) renvoyé(s)`);
    res.json(codes);
  } catch (err) {
    console.error("❌ [EMP] Erreur récupération codes :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ──────────────────────────────────────────────────────────
//  DELETE /api/employees/delete-code/:id
// ──────────────────────────────────────────────────────────
router.delete("/delete-code/:id", isAdminOrPatron, async (req, res) => {
  console.log(`🟡 [EMP] DELETE code — codeId=${req.params.id}`);
  try {
    const deleted = await EmployeeCode.findByIdAndDelete(req.params.id);
    if (!deleted) {
      console.warn("⚠️  [EMP] Code non trouvé :", req.params.id);
      return res.status(404).json({ message: "Code non trouvé." });
    }
    console.log("✅ [EMP] Code supprimé :", deleted.code);
    res.json({ message: "Code supprimé." });
  } catch (err) {
    console.error("❌ [EMP] Erreur suppression code :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ──────────────────────────────────────────────────────────
//  POST /api/employees/generate-code
// ──────────────────────────────────────────────────────────
router.post("/generate-code", isAdminOrPatron, async (req, res) => {
  const { patronId } = req.body;
  console.log(`🟡 [EMP] POST generate-code — patronId=${patronId}`);

  if (!patronId) return res.status(400).json({ message: "ID du patron requis." });

  try {
    await EmployeeCode.deleteMany({ patron: patronId });
    const code = uuidv4().slice(0, 6).toUpperCase();
    await new EmployeeCode({ code, used: false, patron: patronId }).save();

    console.log("✅ [EMP] Nouveau code généré :", code);
    res.status(201).json({ code });
  } catch (err) {
    console.error("❌ [EMP] Erreur génération code :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ──────────────────────────────────────────────────────────
//  POST /api/employees/verify-code
// ──────────────────────────────────────────────────────────
router.post("/verify-code", isAdminOrPatron, async (req, res) => {
  console.log(`🟡 [EMP] POST verify-code — code=${req.body.code}`);
  try {
    const found = await EmployeeCode.findOne({ code: req.body.code, used: false });
    if (!found) {
      console.warn("⚠️  [EMP] Code invalide ou déjà utilisé");
      return res.status(400).json({ valid: false, message: "Code invalide ou déjà utilisé." });
    }
    console.log("✅ [EMP] Code valide pour patron", found.patron);
    res.json({ valid: true, patronId: found.patron });
  } catch (err) {
    console.error("❌ [EMP] Erreur vérification code :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ──────────────────────────────────────────────────────────
//  PUT /api/employees/use-code
// ──────────────────────────────────────────────────────────
router.put("/use-code", isAdminOrPatron, async (req, res) => {
  console.log(`🟡 [EMP] PUT use-code — code=${req.body.code}`);
  try {
    const updated = await EmployeeCode.findOneAndUpdate(
      { code: req.body.code, used: false },
      { used: true },
      { new: true }
    );
    if (!updated) {
      console.warn("⚠️  [EMP] Code déjà utilisé ou inexistant");
      return res.status(400).json({ message: "Code déjà utilisé ou inexistant." });
    }
    console.log("✅ [EMP] Code marqué utilisé :", updated.code);
    res.json({ message: "Code marqué comme utilisé." });
  } catch (err) {
    console.error("❌ [EMP] Erreur use-code :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ──────────────────────────────────────────────────────────
//  GET /api/employees/chauffeurs   ← CORRIGÉ ICI
// ──────────────────────────────────────────────────────────
router.get("/chauffeurs", async (req, res) => {
  console.log("🟡 [EMP] GET chauffeurs");
  const { entrepriseId } = req.query; // filtre optionnel
  try {
    const filter = {
      role: { $in: ["chauffeur", "admin"] },
      ...(entrepriseId && { entrepriseId })
    };

    const list = (await User.find(filter).select("name role"))
                .map(u => ({ nom: u.name, role: u.role }));

    // On ajoute éventuellement le patron pour affichage carte
    const patron = await User.findOne({ role: "patron", ...(entrepriseId && { entrepriseId }) })
                             .select("name");
    if (patron && !list.find(x => x.nom === patron.name))
      list.push({ nom: patron.name, role: "patron" });

    console.log(`✅ [EMP] ${list.length} chauffeur(s) retourné(s)`);
    res.json(list);
  } catch (err) {
    console.error("❌ [EMP] Erreur récupération chauffeurs :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ──────────────────────────────────────────────────────────
//  GET /api/employees/locations
// ──────────────────────────────────────────────────────────
router.get("/locations", async (_req, res) => {
  console.log("🟡 [EMP] GET locations");
  try {
    const locations = (await User.find(
      { role: { $in: ["chauffeur", "patron"] } },
      "name latitude longitude updatedAt"
    ))
      .filter(u => u.latitude != null && u.longitude != null)
      .map(u => ({
        id: u._id,
        name: u.name,
        latitude: u.latitude,
        longitude: u.longitude,
        updatedAt: u.updatedAt,
      }));

    console.log(`✅ [EMP] ${locations.length} localisation(s) renvoyée(s)`);
    res.json(locations);
  } catch (err) {
    console.error("❌ [EMP] Erreur récupération positions :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ──────────────────────────────────────────────────────────
//  POST /api/employees/location
// ──────────────────────────────────────────────────────────
router.post("/location", isChauffeur, async (req, res) => {
  console.log("🟡 [EMP] POST update-location for chauffeur", req.user.id);
  try {
    const { latitude, longitude } = req.body;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      console.warn("⚠️  [EMP] Coordonnées invalides :", req.body);
      return res.status(400).json({ message: "latitude et longitude numériques requis." });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      console.warn("⚠️  [EMP] Chauffeur non trouvé :", req.user.id);
      return res.status(404).json({ message: "Chauffeur non trouvé." });
    }

    user.latitude = latitude;
    user.longitude = longitude;
    user.updatedAt = new Date();
    await user.save();

    console.log("✅ [EMP] Position mise à jour :", latitude, longitude);
    res.json({ message: "Position mise à jour." });
  } catch (err) {
    console.error("❌ [EMP] Erreur mise à jour position :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
