const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");

// 📁 Configuration Multer pour l’upload de fichiers
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/chat");
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// ✅ Créer une nouvelle conversation (privée ou groupe)
router.post("/create", async (req, res) => {
  try {
    const { name, isGroup, members, createdBy } = req.body;

    if (!Array.isArray(members) || members.length < 1) {
      return res.status(400).json({ message: "Liste de membres requise." });
    }

    // 🔐 Vérifie que le créateur existe et récupère son entrepriseId
    const creator = await User.findById(createdBy);
    if (!creator || !creator.entrepriseId) {
      return res.status(400).json({ message: "Créateur invalide ou entreprise non définie." });
    }

    // 🔍 Récupère tous les utilisateurs mentionnés
    const users = await User.find({ _id: { $in: members } });

    if (users.length !== members.length) {
      return res.status(400).json({ message: "Un ou plusieurs membres sont invalides." });
    }

    // 🛡 Vérifie que tous les membres appartiennent à la même entreprise
    const invalidUsers = users.filter((u) => u.entrepriseId !== creator.entrepriseId);
    if (invalidUsers.length > 0) {
      return res.status(403).json({ message: "Tous les membres doivent appartenir à la même entreprise." });
    }

    const conversation = new Conversation({
      name: isGroup ? name : "",
      isGroup,
      members,
      createdBy,
    });

    await conversation.save();
    res.status(201).json(conversation);
  } catch (err) {
    console.error("❌ Erreur création conversation :", err);
    res.status(500).json({ message: "Erreur serveur lors de la création." });
  }
});

// ✅ Récupérer les conversations d’un utilisateur
router.get("/user/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const conversations = await Conversation.find({ members: userId })
      .populate("members", "name email")
      .populate("createdBy", "name");

    res.status(200).json(conversations);
  } catch (err) {
    console.error("❌ Erreur récupération des conversations :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ✅ Envoyer un message (texte ou fichier)
router.post("/send", upload.single("file"), async (req, res) => {
  try {
    const { conversationId, sender, text } = req.body;
    const file = req.file;

    if (!conversationId || !sender || (!text && !file)) {
      return res.status(400).json({ message: "conversationId, sender et (texte ou fichier) requis." });
    }

    const messageData = {
      conversation: conversationId,
      sender,
      readBy: [sender],
    };

    if (text) {
      messageData.text = text;
    }

    if (file) {
      messageData.file = `/uploads/chat/${file.filename}`;
    }

    const message = new Message(messageData);

    await message.save();
    res.status(201).json(message);
  } catch (err) {
    console.error("❌ Erreur envoi message :", err);
    res.status(500).json({ message: "Erreur serveur lors de l’envoi du message." });
  }
});

// ✅ Récupérer et marquer comme lus les messages d’une conversation
router.get("/messages/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "Paramètre userId requis." });
    }

    await Message.updateMany(
      { conversation: conversationId, readBy: { $ne: userId } },
      { $push: { readBy: userId } }
    );

    const messages = await Message.find({ conversation: conversationId })
      .populate("sender", "name email")
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (err) {
    console.error("❌ Erreur récupération messages :", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération." });
  }
});

// ✅ Supprimer une conversation et ses messages
router.delete("/conversations/:id", async (req, res) => {
  try {
    const convId = req.params.id;

    await Message.deleteMany({ conversation: convId });
    await Conversation.findByIdAndDelete(convId);

    res.status(200).json({ message: "✅ Conversation supprimée avec succès." });
  } catch (err) {
    console.error("❌ Erreur suppression conversation :", err);
    res.status(500).json({ message: "Erreur lors de la suppression." });
  }
});

// ✅ Vérifier les messages non lus d'un utilisateur (route optimisée)
router.get("/unread/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const unreadMessages = await Message.countDocuments({
      readBy: { $ne: userId },
      sender: { $ne: userId },
    });
    res.status(200).json({ unreadMessages });
  } catch (err) {
    console.error("❌ Erreur récupération messages non lus:", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
