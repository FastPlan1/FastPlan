const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const User = require("../models/User");
const InviteCode = require("../models/codeInvitation");

dotenv.config();

// ✅ Inscription
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, code } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "⚠️ Nom, email et mot de passe sont obligatoires." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "❌ Cet email est déjà utilisé." });
    }

    let role = "patron";
    let entrepriseId = null;

    if (code) {
      const codeEntry = await InviteCode.findOne({ code });
      if (!codeEntry || codeEntry.used) {
        return res.status(400).json({ message: "❌ Code d'invitation invalide ou déjà utilisé." });
      }

      role = "chauffeur";
      entrepriseId = codeEntry.patron;
      codeEntry.used = true;
      await codeEntry.save();
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
      entrepriseId,
    });

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

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "❌ Mot de passe incorrect." });
    }

    // ✅ Correction ici : on ajoute { id, role, entrepriseId } dans le token
    const token = jwt.sign(
      { id: user._id, role: user.role, entrepriseId: user.entrepriseId || null },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "✅ Connexion réussie",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        entrepriseId: user.entrepriseId || null,
      },
    });
  } catch (error) {
    console.error("❌ Erreur login :", error);
    res.status(500).json({ message: "❌ Erreur serveur pendant la connexion." });
  }
});


// ✅ PATCH utilisateur (utilisé par AuthContext pour ajouter entrepriseId)
router.patch("/users/:id", async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    res.status(200).json({
      message: "✅ Utilisateur mis à jour",
      user: updated,
    });
  } catch (err) {
    console.error("❌ Erreur mise à jour utilisateur :", err);
    res.status(500).json({ message: "Erreur serveur lors de la mise à jour." });
  }
});

module.exports = router;
