const express = require("express");
const router = express.Router();
const EmployeeCode = require("../models/codeInvitation");
const User = require("../models/User"); 
// On utilise désormais User pour récupérer les employés (modèle centralisé)
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

// ✅ Nouveau endpoint : Supprimer un code d’invitation
router.delete("/delete-code/:id", async (req, res) => {
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
});

// ✅ Générer un code d’invitation
router.post("/generate-code", async (req, res) => {
    try {
      const { patronId } = req.body;
      if (!patronId) {
        return res.status(400).json({ message: "ID du patron requis." });
      }
      
      // Optionnel : Supprimer tous les codes existants pour ce patron
      await EmployeeCode.deleteMany({ patron: patronId });
      
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
        // Récupérer tous les chauffeurs
        const chauffeurs = await User.find({ role: "chauffeur" }).select("name");
        // Récupérer le patron
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


// ✅ Récupérer les positions GPS de tous les chauffeurs (et du patron si besoin)
router.get("/locations", async (req, res) => {
    try {
      // On suppose que vos utilisateurs ont des champs `latitude` et `longitude` dans User
      const users = await User.find(
        { role: { $in: ["chauffeur", "patron"] } },
        "name latitude longitude"
      );
      // Filtrer ceux sans position
      const locations = users
        .filter(u => u.latitude != null && u.longitude != null)
        .map(u => ({
          id: u._id,
          name: u.name,
          latitude: u.latitude,
          longitude: u.longitude,
        }));
      res.status(200).json(locations);
    } catch (err) {
      console.error("❌ Erreur récupération positions :", err);
      res.status(500).json({ error: "Impossible de récupérer les positions" });
    }
  });
  
module.exports = router;
