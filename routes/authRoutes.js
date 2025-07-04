const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const dotenv = require("dotenv");
const User = require("../models/User");
const InviteCode = require("../models/codeInvitation");
const nodemailer = require("nodemailer");
dotenv.config();

// Configuration du transporteur d'email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Vérifier la configuration email au démarrage
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Erreur configuration email:', error);
  } else {
    console.log('✅ Serveur email prêt');
  }
});

// Fonction pour générer un code à 6 chiffres
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ✅ Inscription avec code de vérification simple
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
    
    // Générer un code de vérification simple à 6 chiffres
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
      entrepriseId,
      emailVerified: false,
      verificationToken: verificationCode, // On utilise le même champ pour stocker le code
      verificationTokenExpires: verificationCodeExpires
    });
    
    await newUser.save();
    
    // Envoyer l'email avec le code
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'FastPlan <noreply@fastplan.com>',
        to: email,
        subject: `${verificationCode} - Votre code de vérification FastPlan`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #6C63FF; margin-bottom: 10px;">FastPlan</h1>
              <h2 style="color: #333; font-weight: normal;">Vérification de votre email</h2>
            </div>
            
            <div style="background-color: #f5f5f5; border-radius: 10px; padding: 30px; text-align: center;">
              <p style="color: #666; margin-bottom: 20px;">Votre code de vérification est :</p>
              <div style="background-color: #6C63FF; color: white; font-size: 32px; font-weight: bold; padding: 20px; border-radius: 10px; letter-spacing: 5px;">
                ${verificationCode}
              </div>
              <p style="color: #999; margin-top: 20px; font-size: 14px;">Ce code expire dans 15 minutes</p>
            </div>
            
            <p style="color: #666; margin-top: 30px; text-align: center;">
              Si vous n'avez pas créé de compte FastPlan, ignorez cet email.
            </p>
          </div>
        `
      });
      
      console.log(`✅ Code de vérification envoyé à ${email}: ${verificationCode}`);
    } catch (emailError) {
      console.error("❌ Erreur envoi email:", emailError);
      // On supprime l'utilisateur si l'email n'a pas pu être envoyé
      await User.findByIdAndDelete(newUser._id);
      return res.status(500).json({ 
        message: "❌ Impossible d'envoyer l'email de vérification. Veuillez réessayer." 
      });
    }
    
    res.status(201).json({ 
      message: "✅ Inscription réussie ! Un code de vérification a été envoyé à votre email.",
      email: email // On renvoie l'email pour le pré-remplir dans l'écran suivant
    });
    
  } catch (error) {
    console.error("❌ Erreur register :", error);
    res.status(500).json({ message: "❌ Erreur serveur pendant l'inscription." });
  }
});

// ✅ Vérifier le code à 6 chiffres
router.post("/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ message: "⚠️ Email et code requis." });
    }
    
    const user = await User.findOne({
      email: email.toLowerCase(),
      verificationToken: code,
      verificationTokenExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ message: "❌ Code invalide ou expiré." });
    }
    
    user.emailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();
    
    res.status(200).json({ 
      message: "✅ Email vérifié avec succès ! Vous pouvez maintenant vous connecter." 
    });
    
  } catch (error) {
    console.error("❌ Erreur vérification code :", error);
    res.status(500).json({ message: "❌ Erreur serveur." });
  }
});

// ✅ Renvoyer le code de vérification
router.post("/resend-code", async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "❌ Utilisateur non trouvé." });
    }
    
    if (user.emailVerified) {
      return res.status(400).json({ message: "ℹ️ Email déjà vérifié." });
    }
    
    // Générer un nouveau code
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = Date.now() + 15 * 60 * 1000;
    
    user.verificationToken = verificationCode;
    user.verificationTokenExpires = verificationCodeExpires;
    await user.save();
    
    // Renvoyer l'email
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'FastPlan <noreply@fastplan.com>',
      to: email,
      subject: `${verificationCode} - Nouveau code de vérification FastPlan`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6C63FF; margin-bottom: 10px;">FastPlan</h1>
            <h2 style="color: #333; font-weight: normal;">Nouveau code de vérification</h2>
          </div>
          
          <div style="background-color: #f5f5f5; border-radius: 10px; padding: 30px; text-align: center;">
            <p style="color: #666; margin-bottom: 20px;">Votre nouveau code est :</p>
            <div style="background-color: #6C63FF; color: white; font-size: 32px; font-weight: bold; padding: 20px; border-radius: 10px; letter-spacing: 5px;">
              ${verificationCode}
            </div>
            <p style="color: #999; margin-top: 20px; font-size: 14px;">Ce code expire dans 15 minutes</p>
          </div>
        </div>
      `
    });
    
    res.status(200).json({ message: "✅ Nouveau code envoyé !" });
    
  } catch (error) {
    console.error("❌ Erreur renvoi code :", error);
    res.status(500).json({ message: "❌ Erreur serveur." });
  }
});

// ✅ Connexion (vérifie si l'email est validé)
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
    
    // Vérifier si l'email est vérifié
    if (!user.emailVerified) {
      return res.status(401).json({ 
        message: "❌ Veuillez vérifier votre email avant de vous connecter.",
        emailNotVerified: true,
        email: email 
      });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "❌ Mot de passe incorrect." });
    }
    
    // Création du token JWT
    const token = jwt.sign(
      { id: user._id, role: user.role, entrepriseId: user.entrepriseId || null },
      process.env.JWT_SECRET || 'votre_secret_jwt_par_defaut',
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
        entrepriseId: user.entrepriseId || null,
      },
    });
  } catch (error) {
    console.error("❌ Erreur login :", error);
    res.status(500).json({ message: "❌ Erreur serveur pendant la connexion." });
  }
});

// ✅ Le reste du code reste identique (forgot-password, reset-password, etc.)
// ...

// ✅ Demande de réinitialisation du mot de passe
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "⚠️ Email requis." });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      // Ne pas révéler si l'email existe ou non pour des raisons de sécurité
      return res.status(200).json({ 
        message: "✅ Si cet email existe, vous recevrez un lien de réinitialisation." 
      });
    }
    
    // Générer un token de réinitialisation
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = Date.now() + 60 * 60 * 1000; // 1 heure
    
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpires;
    await user.save();
    
    // Envoyer l'email
    // URL pour Expo en développement
    const resetUrl = `exp://localhost:19000/--/reset-password?token=${resetToken}`;
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'FastPlan <noreply@fastplan.com>',
      to: email,
      subject: '🔐 Réinitialisation de votre mot de passe - FastPlan',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6C63FF;">Réinitialisation de mot de passe</h2>
          <p>Bonjour ${user.name},</p>
          <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #FF6584; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          <p>Ou copiez et collez ce lien dans votre navigateur :</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p style="color: #666; font-size: 14px;">Ce lien expirera dans 1 heure.</p>
          <hr style="border: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
        </div>
      `
    });
    
    res.status(200).json({ 
      message: "✅ Si cet email existe, vous recevrez un lien de réinitialisation." 
    });
    
  } catch (error) {
    console.error("❌ Erreur forgot password :", error);
    res.status(500).json({ message: "❌ Erreur serveur." });
  }
});

// ✅ Réinitialiser le mot de passe
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ message: "⚠️ Token et nouveau mot de passe requis." });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        message: "⚠️ Le mot de passe doit contenir au moins 6 caractères." 
      });
    }
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ message: "❌ Token invalide ou expiré." });
    }
    
    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);
    
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    // Envoyer un email de confirmation
    // URL pour Expo en développement
    const loginUrl = `exp://localhost:19000/--/login`;
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'FastPlan <noreply@fastplan.com>',
      to: user.email,
      subject: '✅ Mot de passe modifié - FastPlan',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6C63FF;">Mot de passe modifié avec succès</h2>
          <p>Bonjour ${user.name},</p>
          <p>Votre mot de passe a été modifié avec succès.</p>
          <p>Si vous n'êtes pas à l'origine de cette modification, contactez-nous immédiatement.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" 
               style="background-color: #6C63FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Se connecter
            </a>
          </div>
        </div>
      `
    });
    
    res.status(200).json({ message: "✅ Mot de passe réinitialisé avec succès !" });
    
  } catch (error) {
    console.error("❌ Erreur reset password :", error);
    res.status(500).json({ message: "❌ Erreur serveur." });
  }
});

// ✅ Vérification du token
router.get("/verify-token", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: "❌ Token manquant" });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'votre_secret_jwt_par_defaut');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: "❌ Utilisateur non trouvé" });
    }
    
    res.status(200).json({ 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        entrepriseId: user.entrepriseId || null,
      } 
    });
  } catch (error) {
    console.error("❌ Erreur vérification token :", error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "❌ Token expiré" });
    }
    res.status(401).json({ message: "❌ Token invalide" });
  }
});

// ✅ PATCH utilisateur
router.patch("/users/:id", async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    if (!updated) {
      return res.status(404).json({ message: "❌ Utilisateur non trouvé." });
    }
    
    res.status(200).json({
      message: "✅ Utilisateur mis à jour",
      user: {
        id: updated._id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        entrepriseId: updated.entrepriseId || null,
      }
    });
  } catch (err) {
    console.error("❌ Erreur mise à jour utilisateur :", err);
    res.status(500).json({ message: "❌ Erreur serveur lors de la mise à jour." });
  }
});

module.exports = router;