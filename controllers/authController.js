const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const User = require("../models/User");

dotenv.config();

// ✅ Enregistrement
router.post("/register", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: "⚠️ Tous les champs sont obligatoires." });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "❌ Cet email est déjà utilisé." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword, role });

        await newUser.save();

        res.status(201).json({ message: "✅ Utilisateur enregistré avec succès" });
    } catch (error) {
        console.error("❌ Erreur register :", error);
        res.status(500).json({ message: "❌ Erreur serveur pendant l'inscription." });
    }
});

// ✅ Connexion
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "⚠️ Email et mot de passe requis." });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "❌ Utilisateur non trouvé." });
        }

        if (!user.password) {
            return res.status(500).json({ message: "❌ Mot de passe non trouvé en base." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "❌ Mot de passe incorrect." });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.status(200).json({
            message: "✅ Connexion réussie",
            token,
            user: {
                id: user._id,
                name: user.name, // ✅ ici on envoie bien 'name'
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("❌ Erreur login :", error);
        res.status(500).json({ message: "❌ Erreur serveur pendant la connexion." });
    }
});

module.exports = router;
