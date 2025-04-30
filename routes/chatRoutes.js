const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const { authenticateToken, checkCompanyAccess } = require("../middleware/auth");

// Créer le répertoire d'upload s'il n'existe pas
const uploadDir = path.join(__dirname, "../uploads/chat");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 📁 Configuration Multer pour l'upload de fichiers avec validation
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Sécuriser le nom de fichier
    const fileExt = path.extname(file.originalname);
    const safeFileName = `${Date.now()}-${uuidv4()}${fileExt}`;
    cb(null, safeFileName);
  }
});

// Limites et filtres pour les fichiers
const fileFilter = (req, file, cb) => {
  // Liste des types MIME autorisés
  const allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 1
  }
});

/**
 * @route POST /api/chat/create
 * @desc Créer une nouvelle conversation (privée ou groupe)
 * @access Private
 */
router.post("/create", authenticateToken, async (req, res) => {
  try {
    const { name, isGroup, members: originalMembers, createdBy } = req.body;

    // Validation des entrées
    if (!Array.isArray(originalMembers) || originalMembers.length < 1) {
      return res.status(400).json({
        success: false,
        message: "Liste de membres requise."
      });
    }

    // Vérifier que l'utilisateur crée en tant que lui-même
    if (createdBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas autorisé à créer une conversation pour un autre utilisateur."
      });
    }

    // 🔐 Vérifie que le créateur existe et récupère son entrepriseId
    const creator = await User.findById(createdBy);
    if (!creator || !creator.entrepriseId) {
      return res.status(400).json({
        success: false,
        message: "Créateur invalide ou entreprise non définie."
      });
    }

    // 🧠 Ajoute automatiquement le créateur aux membres s'il n'y est pas
    const members = originalMembers.includes(createdBy)
      ? originalMembers
      : [...originalMembers, createdBy];

    // 🔍 Récupère tous les utilisateurs mentionnés
    const users = await User.find({ _id: { $in: members } });

    if (users.length !== members.length) {
      return res.status(400).json({
        success: false,
        message: "Un ou plusieurs membres sont invalides."
      });
    }

    // 🛡 Vérifie que tous les membres appartiennent à la même entreprise
    const invalidUsers = users.filter((u) => 
      u.entrepriseId && u.entrepriseId.toString() !== creator.entrepriseId.toString()
    );
    
    if (invalidUsers.length > 0) {
      return res.status(403).json({
        success: false,
        message: "Tous les membres doivent appartenir à la même entreprise."
      });
    }

    // Vérification pour les conversations privées (non groupes)
    if (!isGroup && members.length !== 2) {
      return res.status(400).json({
        success: false,
        message: "Une conversation privée doit avoir exactement 2 membres."
      });
    }

    // Pour les conversations privées, vérifions si une conversation existe déjà entre ces 2 personnes
    if (!isGroup) {
      const existingConversation = await Conversation.findOne({
        isGroup: false,
        members: { $all: members, $size: members.length }
      });

      if (existingConversation) {
        return res.status(200).json({
          success: true,
          message: "Une conversation existe déjà",
          conversation: existingConversation
        });
      }
    }

    // Créer la nouvelle conversation
    const conversation = new Conversation({
      name: isGroup ? name : "",
      isGroup,
      members,
      createdBy,
      entrepriseId: creator.entrepriseId,
      createdAt: new Date()
    });

    await conversation.save();

    // Récupérer la conversation avec les populations
    const populatedConversation = await Conversation.findById(conversation._id)
      .populate("members", "name email _id")
      .populate("createdBy", "name email _id");

    res.status(201).json({
      success: true,
      message: "Conversation créée avec succès",
      _id: conversation._id,
      conversation: populatedConversation
    });
  } catch (err) {
    console.error("❌ Erreur création conversation :", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la création de la conversation."
    });
  }
});

/**
 * @route GET /api/chat/user/:userId
 * @desc Récupérer les conversations d'un utilisateur
 * @access Private
 */
router.get("/user/:userId", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;

    // Vérifier que l'utilisateur accède à ses propres conversations
    if (userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas autorisé à accéder aux conversations d'un autre utilisateur."
      });
    }

    // Récupérer les conversations
    const conversations = await Conversation.find({ members: userId })
      .populate("members", "name email _id")
      .populate("createdBy", "name email _id")
      .sort({ updatedAt: -1 });

    // Pour chaque conversation, ajouter le dernier message
    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (conversation) => {
        const lastMessage = await Message.findOne({ conversation: conversation._id })
          .sort({ createdAt: -1 })
          .limit(1)
          .select("text createdAt readBy");

        // Compter les messages non lus pour cette conversation
        const unreadCount = await Message.countDocuments({
          conversation: conversation._id,
          sender: { $ne: userId },
          readBy: { $ne: userId }
        });

        // Convertir en objet pour pouvoir ajouter des propriétés
        const conversationObj = conversation.toObject();
        conversationObj.lastMessage = lastMessage ? lastMessage.text : "";
        conversationObj.lastMessageAt = lastMessage ? lastMessage.createdAt : conversation.createdAt;
        conversationObj.unreadCount = unreadCount;

        return conversationObj;
      })
    );

    // Trier par dernier message le plus récent
    conversationsWithLastMessage.sort((a, b) => 
      new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
    );

    res.status(200).json(conversationsWithLastMessage);
  } catch (err) {
    console.error("❌ Erreur récupération des conversations :", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des conversations."
    });
  }
});

/**
 * @route POST /api/chat/send
 * @desc Envoyer un message (texte ou fichier)
 * @access Private
 */
router.post("/send", authenticateToken, upload.single("file"), async (req, res) => {
  try {
    const { conversationId, sender, text } = req.body;
    const file = req.file;

    // Validation de base
    if (!conversationId || !sender || (!text && !file)) {
      return res.status(400).json({
        success: false,
        message: "conversationId, sender et (texte ou fichier) requis."
      });
    }

    // Vérifier que l'utilisateur envoie en tant que lui-même
    if (sender !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas autorisé à envoyer des messages pour un autre utilisateur."
      });
    }

    // Vérifier que la conversation existe et que l'utilisateur en est membre
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation non trouvée."
      });
    }

    if (!conversation.members.includes(sender)) {
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas membre de cette conversation."
      });
    }

    // Préparer les données du message
    const messageData = {
      conversation: conversationId,
      sender,
      readBy: [sender],
      createdAt: new Date(),
    };

    if (text) {
      messageData.text = text;
    }

    if (file) {
      messageData.file = `/uploads/chat/${file.filename}`;
      messageData.fileName = file.originalname;
      messageData.fileType = file.mimetype;
      messageData.fileSize = file.size;
    }

    // Créer et sauvegarder le message
    const message = new Message(messageData);
    await message.save();

    // Mettre à jour la date de mise à jour de la conversation
    conversation.updatedAt = Date.now();
    await conversation.save();

    // Récupérer le message avec la population
    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name email _id");

    res.status(201).json({
      success: true,
      message: "Message envoyé avec succès",
      messageData: populatedMessage
    });
  } catch (err) {
    console.error("❌ Erreur envoi message :", err);
    
    // Si c'est une erreur Multer
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: "Fichier trop volumineux. Taille maximale: 10MB."
      });
    }
    
    if (err.message === 'Type de fichier non autorisé') {
      return res.status(400).json({
        success: false,
        message: "Type de fichier non autorisé."
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de l'envoi du message."
    });
  }
});

/**
 * @route GET /api/chat/messages/:conversationId
 * @desc Récupérer et marquer comme lus les messages d'une conversation
 * @access Private
 */
router.get("/messages/:conversationId", authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.query;
    const { limit = 50, before } = req.query;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Paramètre userId requis."
      });
    }

    // Vérifier que l'utilisateur accède à ses propres messages
    if (userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas autorisé à accéder aux messages d'un autre utilisateur."
      });
    }

    // Vérifier que la conversation existe et que l'utilisateur en est membre
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation non trouvée."
      });
    }

    if (!conversation.members.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas membre de cette conversation."
      });
    }

    // Marquer les messages comme lus
    await Message.updateMany(
      { conversation: conversationId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    // Construire la requête de base
    let query = { conversation: conversationId };
    
    // Si before est fourni, récupérer les messages avant cette date
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    // Récupérer les messages avec pagination
    const messages = await Message.find(query)
      .populate("sender", "name email _id")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (err) {
    console.error("❌ Erreur récupération messages :", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des messages."
    });
  }
});

/**
 * @route DELETE /api/chat/conversations/:id
 * @desc Supprimer une conversation et ses messages
 * @access Private
 */
router.delete("/conversations/:id", authenticateToken, async (req, res) => {
  try {
    const convId = req.params.id;

    // Vérifier que la conversation existe et que l'utilisateur est autorisé
    const conversation = await Conversation.findById(convId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation non trouvée."
      });
    }

    // Seul le créateur ou un administrateur peut supprimer la conversation
    if (conversation.createdBy.toString() !== req.user.id && req.user.role !== 'patron') {
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas autorisé à supprimer cette conversation."
      });
    }

    // Trouver tous les messages avec des fichiers joints
    const messagesWithFiles = await Message.find({
      conversation: convId,
      file: { $exists: true, $ne: null }
    });

    // Supprimer les fichiers du serveur
    messagesWithFiles.forEach(message => {
      if (message.file) {
        const filePath = path.join(__dirname, '..', message.file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    // Supprimer les messages et la conversation
    await Message.deleteMany({ conversation: convId });
    await Conversation.findByIdAndDelete(convId);

    res.status(200).json({
      success: true,
      message: "✅ Conversation supprimée avec succès."
    });
  } catch (err) {
    console.error("❌ Erreur suppression conversation :", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la suppression de la conversation."
    });
  }
});

/**
 * @route GET /api/chat/unread/:userId
 * @desc Vérifier les messages non lus d'un utilisateur
 * @access Private
 */
router.get("/unread/:userId", authenticateToken, async (req, res) => {
  const { userId } = req.params;

  // Vérifier que l'utilisateur accède à ses propres données
  if (userId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "Vous n'êtes pas autorisé à accéder aux messages non lus d'un autre utilisateur."
    });
  }

  try {
    // Récupérer les conversations de l'utilisateur
    const conversations = await Conversation.find({ members: userId });
    const conversationIds = conversations.map(c => c._id);

    // Compter les messages non lus dans toutes les conversations
    const unreadMessages = await Message.countDocuments({
      conversation: { $in: conversationIds },
      readBy: { $ne: userId },
      sender: { $ne: userId },
    });

    // Récupérer les détails des messages non lus par conversation
    const unreadByConversation = await Message.aggregate([
      {
        $match: {
          conversation: { $in: conversationIds },
          readBy: { $ne: userId },
          sender: { $ne: userId }
        }
      },
      {
        $group: {
          _id: "$conversation",
          count: { $sum: 1 },
          lastMessageAt: { $max: "$createdAt" }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      unreadMessages,
      unreadByConversation
    });
  } catch (err) {
    console.error("❌ Erreur récupération messages non lus:", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des messages non lus."
    });
  }
});

/**
 * @route POST /api/chat/read
 * @desc Marquer les messages d'une conversation comme lus
 * @access Private
 */
router.post("/read", authenticateToken, async (req, res) => {
  try {
    const { conversationId, userId } = req.body;

    if (!conversationId || !userId) {
      return res.status(400).json({
        success: false,
        message: "conversationId et userId sont requis."
      });
    }

    // Vérifier que l'utilisateur marque ses propres messages
    if (userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas autorisé à marquer les messages comme lus pour un autre utilisateur."
      });
    }

    // Marquer les messages comme lus
    const result = await Message.updateMany(
      { conversation: conversationId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    res.status(200).json({
      success: true,
      message: "Messages marqués comme lus.",
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error("❌ Erreur marquage messages comme lus:", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors du marquage des messages comme lus."
    });
  }
});

/**
 * @route GET /api/chat/file/:fileName
 * @desc Télécharger un fichier
 * @access Private
 */
router.get("/file/:fileName", authenticateToken, async (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(__dirname, "../uploads/chat", fileName);

    // Vérifier si le fichier existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "Fichier non trouvé."
      });
    }

    // Trouver le message associé à ce fichier
    const filePathInDB = `/uploads/chat/${fileName}`;
    const message = await Message.findOne({ file: filePathInDB }).populate('conversation');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message associé au fichier non trouvé."
      });
    }

    // Vérifier que l'utilisateur est autorisé à accéder à ce fichier
    const conversation = await Conversation.findById(message.conversation);
    if (!conversation || !conversation.members.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas autorisé à accéder à ce fichier."
      });
    }

    // Définir le type MIME
    const mimeType = message.fileType || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    
    // Définir le nom du fichier pour le téléchargement
    res.setHeader('Content-Disposition', `attachment; filename="${message.fileName || fileName}"`);
    
    // Envoyer le fichier
    return res.sendFile(filePath);
  } catch (err) {
    console.error("❌ Erreur téléchargement fichier:", err);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors du téléchargement du fichier."
    });
  }
});

module.exports = router;