const express = require("express");
const router = express.Router();
const EmployeeCode = require("../models/codeInvitation");
const User = require("../models/User"); 
// ↑ On utilise désormais User pour récupérer les employés (puisque tu as centralisé le modèle dans User.js)

const { v4: uuidv4 } = require("uuid");

// ✅ Vérification que le fichier est bien chargé
console.log("📡 Routes de employeeRoutes.js chargées !");

// ✅ Récupérer les employés d’un patron
router.get("/by-patron/:id", async (req, res) => {
    try {
        const patronId = req.params.id;

        const employees = await User.find({
            entrepriseId: patronId,
        }).select("name email");

        res.status(200).json(employees);
    } catch (err) {
        console.error("❌ Erreur récupération des employés :", err);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// ✅ Récupérer les codes d’invitation d’un patron
router.get("/codes/by-patron/:id", async (req, res) => {
    try {
        const patronId = req.params.id;
        const codes = await EmployeeCode.find({ patron: patronId }).sort({ createdAt: -1 });
        res.status(200).json(codes);
    } catch (err) {
        console.error("❌ Erreur récupération des codes :", err);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// 🔐 Générer un code d’invitation
router.post("/generate-code", async (req, res) => {
    try {
      const { patronId } = req.body;
      if (!patronId) {
        return res.status(400).json({ message: "ID du patron requis." });
      }
  
      const code = uuidv4().slice(0, 6).toUpperCase();
      const newCode = new EmployeeCode({ code, used: false, patron: patronId });
      await newCode.save();
  
      res.status(201).json({ code });
    } catch (err) {
      console.error("❌ Erreur génération code :", err);
      res.status(500).json({ message: "Erreur serveur lors de la génération du code." });
    }
  });
  

// ✅ Vérifier un code d’invitation
router.post("/verify-code", async (req, res) => {
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
});

// ✅ Marquer un code comme utilisé
router.put("/use-code", async (req, res) => {
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
});

// ✅ Récupérer tous les chauffeurs (et inclure le patron)
router.get("/chauffeurs", async (req, res) => {
    try {
        // On récupère tous les chauffeurs
        const chauffeurs = await User.find({ role: "chauffeur" }).select("name");

        // On récupère le patron (il doit être identifiable)
        const patron = await User.findOne({ role: "patron" }).select("name");

        // Format uniforme
        const result = chauffeurs.map(c => ({ nom: c.name }));

        if (patron && !result.find(c => c.nom === patron.name)) {
            result.push({ nom: patron.name });
        }

        res.status(200).json(result);
    } catch (err) {
        console.error("❌ Erreur récupération des chauffeurs :", err.message);
        res.status(500).json({ message: "Erreur serveur" });
    }
});


module.exports = router;
