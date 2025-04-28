const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const authHeader = req.header("Authorization") || "";
  
  console.log('🔑 Token reçu :', authHeader); // Ajoute ce log
  
  if (!authHeader.startsWith("Bearer ")) {
    console.log("⚠️ Token manquant ou mal formaté !");
    return res.status(401).json({ message: "Accès refusé. Token manquant." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    console.log("✅ Token valide, payload :", payload); // Log payload
    next();
  } catch (err) {
    console.error("❌ Erreur vérification JWT :", err.message);
    return res.status(401).json({ message: "Token invalide." });
  }
}
console.log("🚨 Payload JWT reçu :", req.user);

/**
 * Autorise uniquement les patrons (role === 'patron')
 */
function isPatron(req, res, next) {
  if (!req.user || req.user.role !== "patron") {
    return res.status(403).json({ message: "Accès interdit : seul un patron." });
  }
  next();
}

/**
 * Autorise uniquement les chauffeurs (role === 'chauffeur')
 */
function isChauffeur(req, res, next) {
  if (!req.user || req.user.role !== "chauffeur") {
    return res.status(403).json({ message: "Accès interdit : seul un chauffeur." });
  }
  next();
}

/**
 * Autorise les admins ET les patrons
 */
function isAdminOrPatron(req, res, next) {
  if (!req.user || !["admin", "patron"].includes(req.user.role)) {
    return res
      .status(403)
      .json({ message: "Accès interdit : admin ou patron seulement." });
  }
  next();
}

module.exports = {
  authMiddleware,
  isPatron,
  isChauffeur,
  isAdminOrPatron,
};
