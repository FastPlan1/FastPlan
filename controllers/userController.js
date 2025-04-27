  // controllers/userController.js

const User = require('../models/User');

/**
 * PUT /employees/:id
 * Met à jour le rôle d’un utilisateur (chauffeur ↔ admin)
 */
exports.updateRole = async (req, res) => {
  const { id }   = req.params;
  const { role } = req.body;

  // Valider le rôle
  if (!['chauffeur', 'admin', 'patron'].includes(role)) {
    return res.status(400).json({ message: 'Rôle invalide.' });
  }

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }
    user.role = role;
    await user.save();
    return res.json({ id: user._id, name: user.name, role: user.role });
  } catch (err) {
    console.error('❌ Erreur updateRole:', err);
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
};

