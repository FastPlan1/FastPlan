const express = require("express");
const router = express.Router();
const CodeInvitation = require("../models/CodeInvitation");
const User = require("../models/User");

// Fonction pour générer un code aléatoire de 6 caractères
function genererCodeUnique(longueur = 6) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < longueur; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// ✅ Générer un nouveau code pour un patron
router.post("/generer", async (req, res) => {
    try {
        const { patronId } = req.body;

        if (!patronId) {
            return res.status(400).json({ message: "🛑 ID du patron manquant." });
        }

        const patron = await User.findById(patronId);
        if (!patron || patron.role !== "patron") {
            return res.status(403).json({ message: "🚫 Seul un patron peut générer un code." });
        }

        let code;
        let codeExiste;

        // Boucle pour garantir l’unicité
        do {
            code = genererCodeUnique();
            codeExiste = await CodeInvitation.findOne({ code });
        } while (codeExiste);

        const nouveauCode = new CodeInvitation({ code, patronId });
        await nouveauCode.save();

        res.status(201).json({ message: "✅ Code généré avec succès", code: nouveauCode.code });
    } catch (err) {
        console.error("❌ Erreur génération code :", err);
        res.status(500).json({ message: "❌ Erreur serveur", error: err.message });
    }
});

module.exports = router;

