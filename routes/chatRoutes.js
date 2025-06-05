const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");

// 📁 Configuration Multer pour l'upload de fichiers
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

// 🛠️ Fonction utilitaire pour valider les IDs utilisateur
const isValidUserId = (userId) => {
  return userId && 
         userId !== 'undefined' && 
         userId !== undefined && 
         userId !== null && 
         typeof userId === 'string' && 
         userId.trim() !== '' &&
         userId.length >= 10; // Supposant que les IDs MongoDB font au moins 10 caractères
};

// ✅ Créer une nouvelle conversation (privée ou groupe)
router.post("/create", async (req, res) => {
  try {
    const { name, isGroup, members: originalMembers, createdBy } = req.body;

    console.log("📝 Création conversation - Données reçues:", { name, isGroup, originalMembers, createdBy });

    // 🔐 Validation des données d'entrée
    if (!createdBy || !isValidUserId(createdBy)) {
      console.log("❌ Créateur invalide:", createdBy);
      return res.status(400).json({ message: "Créateur requis et valide." });
    }

    if (!Array.isArray(originalMembers) || originalMembers.length < 1) {
      console.log("❌ Membres invalides:", originalMembers);
      return res.status(400).json({ message: "Au moins un membre requis." });
    }

    if (isGroup && (!name || !name.trim())) {
      console.log("❌ Nom du groupe manquant pour un groupe");
      return res.status(400).json({ message: "Nom du groupe requis pour créer un groupe." });
    }

    // Vérifier que tous les membres ont des IDs valides
    const invalidMembers = originalMembers.filter(id => !isValidUserId(id));
    if (invalidMembers.length > 0) {
      console.log("❌ Membres avec IDs invalides:", invalidMembers);
      return res.status(400).json({ message: "Un ou plusieurs IDs de membres sont invalides." });
    }

    // 🔐 Vérifie que le créateur existe et récupère son entrepriseId
    const creator = await User.findById(createdBy);
    if (!creator) {
      console.log("❌ Créateur non trouvé en base:", createdBy);
      return res.status(400).json({ message: "Créateur introuvable." });
    }

    if (!creator.entrepriseId) {
      console.log("❌ Créateur sans entreprise:", creator);
      return res.status(400).json({ message: "Créateur non associé à une entreprise." });
    }

    // 🧠 Ajoute automatiquement le créateur aux membres s'il n'y est pas
    const members = originalMembers.includes(createdBy)
      ? originalMembers
      : [...originalMembers, createdBy];

    console.log("👥 Membres finaux:", members);

    // 🔍 Récupère tous les utilisateurs mentionnés
    const users = await User.find({ _id: { $in: members } });
    console.log("👤 Utilisateurs trouvés:", users.length, "sur", members.length);

    if (users.length !== members.length) {
      const foundIds = users.map(u => u._id.toString());
      const missingIds = members.filter(id => !foundIds.includes(id));
      console.log("❌ Utilisateurs manquants:", missingIds);
      return res.status(400).json({ 
        message: `Utilisateurs introuvables: ${missingIds.join(", ")}` 
      });
    }

    // 🛡 Vérifie que tous les membres appartiennent à la même entreprise
    const invalidUsers = users.filter((u) => u.entrepriseId !== creator.entrepriseId);
    if (invalidUsers.length > 0) {
      console.log("❌ Utilisateurs d'entreprises différentes:", invalidUsers.map(u => u._id));
      return res.status(403).json({ 
        message: "Tous les membres doivent appartenir à la même entreprise." 
      });
    }

    // Vérifier si une conversation privée existe déjà (pour les conversations non-groupe)
    if (!isGroup && members.length === 2) {
      const existingConversation = await Conversation.findOne({
        isGroup: false,
        members: { $all: members, $size: 2 }
      });

      if (existingConversation) {
        console.log("ℹ️ Conversation privée existante trouvée:", existingConversation._id);
        return res.status(200).json({
          ...existingConversation.toObject(),
          message: "Conversation existante récupérée"
        });
      }
    }

    // Créer la nouvelle conversation
    const conversation = new Conversation({
      name: isGroup ? name.trim() : "",
      isGroup,
      members,
      createdBy,
    });

    await conversation.save();
    console.log("✅ Conversation créée:", conversation._id);

    // Peupler les données pour la réponse
    const populatedConversation = await Conversation.findById(conversation._id)
      .populate("members", "name email")
      .populate("createdBy", "name");

    res.status(201).json(populatedConversation);
  } catch (err) {
    console.error("❌ Erreur création conversation :", err);
    res.status(500).json({ 
      message: "Erreur serveur lors de la création.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ Récupérer les conversations d'un utilisateur
router.get("/user/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Vérifier si userId est valide
    if (!isValidUserId(userId)) {
      console.log("❌ UserId invalide pour récupération conversations:", userId);
      return res.status(400).json({ message: "ID utilisateur invalide" });
    }

    console.log("🔍 Récupération conversations pour:", userId);

    const conversations = await Conversation.find({ members: userId })
      .populate("members", "name email")
      .populate("createdBy", "name")
      .sort({ updatedAt: -1 }); // Trier par date de mise à jour

    console.log("📋 Conversations trouvées:", conversations.length);
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

    console.log("📤 Envoi message:", { conversationId, sender, hasText: !!text, hasFile: !!file });

    if (!conversationId || !isValidUserId(sender) || (!text && !file)) {
      return res.status(400).json({ 
        message: "ConversationId, sender valide et (texte ou fichier) requis." 
      });
    }

    // Vérifier que la conversation existe et que l'utilisateur en fait partie
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation introuvable." });
    }

    if (!conversation.members.includes(sender)) {
      return res.status(403).json({ message: "Vous n'êtes pas membre de cette conversation." });
    }

    const messageData = {
      conversation: conversationId,
      sender,
      readBy: [sender],
    };

    if (text && text.trim()) {
      messageData.text = text.trim();
    }

    if (file) {
      messageData.file = `/uploads/chat/${file.filename}`;
    }

    const message = new Message(messageData);
    await message.save();

    // Mettre à jour la conversation avec le dernier message
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: text || "Fichier partagé",
      lastMessageAt: new Date()
    });

    // Peupler les données du message pour la réponse
    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name email");

    console.log("✅ Message envoyé:", message._id);
    res.status(201).json(populatedMessage);
  } catch (err) {
    console.error("❌ Erreur envoi message :", err);
    res.status(500).json({ message: "Erreur serveur lors de l'envoi du message." });
  }
});

// ✅ Récupérer et marquer comme lus les messages d'une conversation
router.get("/messages/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.query;

    if (!isValidUserId(userId)) {
      return res.status(400).json({ message: "Paramètre userId requis et valide." });
    }

    console.log("📥 Récupération messages pour conversation:", conversationId, "user:", userId);

    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation introuvable." });
    }

    if (!conversation.members.includes(userId)) {
      return res.status(403).json({ message: "Accès non autorisé à cette conversation." });
    }

    // Marquer les messages comme lus
    await Message.updateMany(
      { conversation: conversationId, readBy: { $ne: userId } },
      { $push: { readBy: userId } }
    );

    // Récupérer les messages
    const messages = await Message.find({ conversation: conversationId })
      .populate("sender", "name email")
      .sort({ createdAt: 1 });

    console.log("📨 Messages récupérés:", messages.length);
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
    const { userId } = req.query; // Qui demande la suppression

    if (!isValidUserId(userId)) {
      return res.status(400).json({ message: "UserId requis pour la suppression." });
    }

    // Vérifier que l'utilisateur a le droit de supprimer
    const conversation = await Conversation.findById(convId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation introuvable." });
    }

    if (conversation.createdBy !== userId && !conversation.members.includes(userId)) {
      return res.status(403).json({ message: "Vous n'avez pas le droit de supprimer cette conversation." });
    }

    await Message.deleteMany({ conversation: convId });
    await Conversation.findByIdAndDelete(convId);

    console.log("🗑️ Conversation supprimée:", convId);
    res.status(200).json({ message: "✅ Conversation supprimée avec succès." });
  } catch (err) {
    console.error("❌ Erreur suppression conversation :", err);
    res.status(500).json({ message: "Erreur lors de la suppression." });
  }
});

// ✅ Vérifier les messages non lus d'un utilisateur (route optimisée)
router.get("/unread/:userId", async (req, res) => {
  const { userId } = req.params;
  
  // Vérifier si userId est valide
  if (!isValidUserId(userId)) {
    console.log("❌ UserId invalide pour messages non lus:", userId);
    return res.status(400).json({ message: "ID utilisateur invalide" });
  }
  
  try {
    // Compter les messages non lus où l'utilisateur n'est pas l'expéditeur
    const unreadMessages = await Message.countDocuments({
      readBy: { $ne: userId },
      sender: { $ne: userId },
    });

    console.log("📊 Messages non lus pour", userId, ":", unreadMessages);
    res.status(200).json({ unreadMessages });
  } catch (err) {
    console.error("❌ Erreur récupération messages non lus:", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;