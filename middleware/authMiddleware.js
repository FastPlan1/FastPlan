const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const authHeader = req.header("Authorization") || "";

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Accès refusé. Token manquant." });
  }

  const token = authHeader.split(" ")[1];
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;

    console.log("🚨 Payload JWT reçu :", req.user); // ✅ A METTRE ICI, à l'intérieur de la fonction !!

    next();
  } catch (err) {
    return res.status(401).json({ message: "Token invalide." });
  }
}

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
