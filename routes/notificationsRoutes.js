const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");

// ✅ Récupérer les notifications d'une entreprise
router.get("/:entrepriseId", async (req, res) => {
  try {
    const notifications = await Notification.find({ entrepriseId: req.params.entrepriseId }).sort({ createdAt: -1 });
    res.status(200).json(notifications);
  } catch (err) {
    console.error("❌ Erreur récupération notifications :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ Marquer une notification comme lue
router.patch("/lu/:id", async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { vue: true }, // 🔧 ici c’est "vue" et pas "lu"
      { new: true }
    );
    res.status(200).json(notification);
  } catch (err) {
    console.error("❌ Erreur marquage notification :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
