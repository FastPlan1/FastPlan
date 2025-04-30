const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Middleware d'authentification par JWT
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.header("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Accès refusé. Token manquant." });
  }
  const token = authHeader.split(" ")[1];
 
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    // Récupérer les informations complètes de l'utilisateur
    const user = await User.findById(payload.id).select("-password");
    
    if (!user) {
      return res.status(401).json({ message: "Utilisateur non trouvé." });
    }
    
    // Enrichir le payload avec les informations complètes de l'utilisateur
    req.user = {
      ...payload,
      entrepriseId: user.entrepriseId,
      name: user.name,
      email: user.email
    };
    
    console.log("🚨 Payload JWT enrichi :", req.user);
    next();
  } catch (err) {
    console.error("❌ Erreur JWT :", err);
    return res.status(401).json({ message: "Token invalide." });
  }
}

/**
 * Vérifie si l'utilisateur est un patron
 */
function isPatron(req, res, next) {
  if (!req.user || req.user.role !== "patron") {
    return res.status(403).json({ message: "Accès interdit : seul un patron." });
  }
  next();
}

/**
 * Vérifie si l'utilisateur est un chauffeur
 */
function isChauffeur(req, res, next) {
  if (!req.user || req.user.role !== "chauffeur") {
    return res.status(403).json({ message: "Accès interdit : seul un chauffeur." });
  }
  next();
}

/**
 * Vérifie si l'utilisateur est un admin ou un patron
 */
function isAdminOrPatron(req, res, next) {
  if (!req.user || !["admin", "patron"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès interdit : admin ou patron seulement." });
  }
  next();
}

/**
 * Vérifie si l'utilisateur appartient à la même entreprise que la ressource
 * @param {String} paramName - Le nom du paramètre contenant l'ID de l'entreprise
 */
function isSameEntreprise(paramName = 'entrepriseId') {
  return (req, res, next) => {
    const resourceEntrepriseId = req.params[paramName] || req.body[paramName];
    
    if (!resourceEntrepriseId) {
      return res.status(400).json({ message: "ID d'entreprise manquant." });
    }
    
    if (!req.user.entrepriseId) {
      return res.status(403).json({ message: "Entreprise non associée à l'utilisateur." });
    }
    
    if (req.user.entrepriseId.toString() !== resourceEntrepriseId.toString()) {
      return res.status(403).json({ message: "Accès interdit : entreprise différente." });
    }
    
    next();
  };
}

/**
 * Vérifie si l'utilisateur est propriétaire de la ressource
 * @param {Function} getResourceOwner - Fonction qui retourne le propriétaire de la ressource
 */
function isOwner(getResourceOwner) {
  return async (req, res, next) => {
    try {
      const ownerId = await getResourceOwner(req);
      
      if (!ownerId) {
        return res.status(404).json({ message: "Ressource non trouvée." });
      }
      
      if (ownerId.toString() !== req.user.id) {
        return res.status(403).json({ message: "Accès interdit : vous n'êtes pas le propriétaire." });
      }
      
      next();
    } catch (err) {
      console.error("❌ Erreur vérification propriétaire :", err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  };
}

module.exports = {
  authMiddleware,
  isPatron,
  isChauffeur,
  isAdminOrPatron,
  isSameEntreprise,
  isOwner
};