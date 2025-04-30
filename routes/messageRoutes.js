const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');

console.log("📡 Routes de messageRoutes.js chargées !");

// On applique le JWT à toutes les routes
router.use(authMiddleware);

/**
 * GET /api/messages
 * Récupère les messages (stub temporaire)
 */
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Fonctionnalité de messages en cours de développement",
      data: []
    });
  } catch (error) {
    console.error("❌ Erreur récupération messages:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
