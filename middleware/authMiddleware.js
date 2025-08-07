const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "❌ Token d'authentification manquant" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "❌ Utilisateur non trouvé" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("❌ Erreur authentification:", error);
    res.status(401).json({ message: "❌ Token invalide" });
  }
};

function isPatron(req, res, next) {
  if (!req.user || req.user.role !== "patron") {
    return res.status(403).json({ message: "Accès interdit : seul un patron." });
  }
  next();
}

function isChauffeur(req, res, next) {
  if (!req.user || req.user.role !== "chauffeur") {
    return res.status(403).json({ message: "Accès interdit : seul un chauffeur." });
  }
  next();
}

function isAdminOrPatron(req, res, next) {
  if (!req.user || !["admin", "patron"].includes(req.user.role)) {
    return res.status(403).json({ message: "Accès interdit : admin ou patron seulement." });
  }
  next();
}

module.exports = {
  authMiddleware,
  isPatron,
  isChauffeur,
  isAdminOrPatron,
};
