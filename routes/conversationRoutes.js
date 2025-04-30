const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');

console.log("📡 Routes de conversationRoutes.js chargées !");

// On applique le JWT à toutes les routes
router.use(authMiddleware);

/**
 * GET /api/conversations
 * Récupère les conversations (stub temporaire)
 */
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Fonctionnalité de conversations en cours de développement",
      data: []
    });
  } catch (error) {
    console.error("❌ Erreur récupération conversations:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;