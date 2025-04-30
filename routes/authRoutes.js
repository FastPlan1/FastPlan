const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const User = require("../models/User");
const Entreprise = require("../models/Entreprise");
const { authMiddleware } = require("../middleware/authMiddleware");

dotenv.config();

// ✅ Enregistrement
router.post("/register", async (req, res) => {
    try {
        const { name, email, password, role, entrepriseId } = req.body;
        
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: "⚠️ Tous les champs sont obligatoires." });
        }
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "❌ Cet email est déjà utilisé." });
        }
        
        // Si c'est un patron et qu'aucune entreprise n'est fournie, créer une nouvelle entreprise
        let userEntrepriseId = entrepriseId;
        
        if (role === "patron" && !userEntrepriseId) {
            const newEntreprise = new Entreprise({
                name: `Entreprise de ${name}`,
                createdBy: null  // On mettra à jour après la création de l'utilisateur
            });
            
            const savedEntreprise = await newEntreprise.save();
            userEntrepriseId = savedEntreprise._id;
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ 
            name, 
            email, 
            password: hashedPassword, 
            role,
            entrepriseId: userEntrepriseId
        });
        
        const savedUser = await newUser.save();
        
        // Si c'est un patron qui a créé une entreprise, mettre à jour l'entreprise
        if (role === "patron" && !entrepriseId) {
            await Entreprise.findByIdAndUpdate(userEntrepriseId, {
                createdBy: savedUser._id
            });
        }
        
        res.status(201).json({ 
            message: "✅ Utilisateur enregistré avec succès",
            user: {
                id: savedUser._id,
                name: savedUser.name,
                email: savedUser.email,
                role: savedUser.role,
                entrepriseId: savedUser.entrepriseId
            }
        });
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
        
        // Inclure l'ID d'entreprise dans le token
        const token = jwt.sign(
            { 
                id: user._id, 
                role: user.role,
                entrepriseId: user.entrepriseId 
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );
        
        res.status(200).json({
            message: "✅ Connexion réussie",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                entrepriseId: user.entrepriseId
            }
        });
    } catch (error) {
        console.error("❌ Erreur login :", error);
        res.status(500).json({ message: "❌ Erreur serveur pendant la connexion." });
    }
});

// 🔒 Obtenir le profil de l'utilisateur connecté
router.get("/me", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        
        if (!user) {
            return res.status(404).json({ message: "❌ Utilisateur non trouvé." });
        }
        
        res.json(user);
    } catch (error) {
        console.error("❌ Erreur récupération profil :", error);
        res.status(500).json({ message: "❌ Erreur serveur." });
    }
});

// 🔄 Mettre à jour le profil (informations de base)
router.put("/update-profile", authMiddleware, async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        
        // Construire l'objet de mise à jour
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (phone) updateData.phone = phone;
        
        // Vérifier si l'email est déjà utilisé
        if (email) {
            const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
            if (existingUser) {
                return res.status(409).json({ message: "❌ Cet email est déjà utilisé." });
            }
        }
        
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updateData },
            { new: true }
        ).select("-password");
        
        if (!updatedUser) {
            return res.status(404).json({ message: "❌ Utilisateur non trouvé." });
        }
        
        res.json({
            message: "✅ Profil mis à jour avec succès",
            user: updatedUser
        });
    } catch (error) {
        console.error("❌ Erreur mise à jour profil :", error);
        res.status(500).json({ message: "❌ Erreur serveur." });
    }
});

// 🔑 Changer le mot de passe
router.put("/change-password", authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                message: "⚠️ Mot de passe actuel et nouveau mot de passe requis." 
            });
        }
        
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ message: "❌ Utilisateur non trouvé." });
        }
        
        // Vérifier le mot de passe actuel
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        
        if (!isMatch) {
            return res.status(401).json({ message: "❌ Mot de passe actuel incorrect." });
        }
        
        // Hasher le nouveau mot de passe
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Mettre à jour le mot de passe
        user.password = hashedPassword;
        await user.save();
        
        res.json({ message: "✅ Mot de passe changé avec succès" });
    } catch (error) {
        console.error("❌ Erreur changement mot de passe :", error);
        res.status(500).json({ message: "❌ Erreur serveur." });
    }
});

// 📱 Mettre à jour la position de l'utilisateur
router.post("/update-location", authMiddleware, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        
        if (typeof latitude !== "number" || typeof longitude !== "number") {
            return res.status(400).json({ 
                message: "⚠️ Latitude et longitude doivent être des nombres." 
            });
        }
        
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { 
                $set: { 
                    latitude, 
                    longitude,
                    lastLocationUpdate: new Date()
                } 
            },
            { new: true }
        ).select("name latitude longitude lastLocationUpdate");
        
        if (!updatedUser) {
            return res.status(404).json({ message: "❌ Utilisateur non trouvé." });
        }
        
        // Envoyer la mise à jour via Socket.IO si disponible
        const io = req.app.get("io");
        
        if (io && req.user.entrepriseId) {
            io.to(`entreprise:${req.user.entrepriseId}`).emit("location-update", {
                userId: updatedUser._id,
                name: updatedUser.name,
                latitude,
                longitude,
                timestamp: updatedUser.lastLocationUpdate
            });
        }
        
        res.json({
            message: "✅ Position mise à jour avec succès",
            location: {
                latitude: updatedUser.latitude,
                longitude: updatedUser.longitude,
                updatedAt: updatedUser.lastLocationUpdate
            }
        });
    } catch (error) {
        console.error("❌ Erreur mise à jour position :", error);
        res.status(500).json({ message: "❌ Erreur serveur." });
    }
});

module.exports = router;