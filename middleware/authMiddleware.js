const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const token = req.header("Authorization");
    if (!token) return res.status(401).json({ message: "Accès refusé. Aucun token fourni." });

    try {
        const tokenWithoutBearer = token.split(" ")[1];
        console.log("🔎 Token reçu :", tokenWithoutBearer);
        console.log("🔑 JWT_SECRET utilisé pour vérifier :", process.env.JWT_SECRET);

        const verified = jwt.verify(tokenWithoutBearer, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        console.error("❌ Erreur de validation du token :", err.message);
        res.status(400).json({ message: "Token invalide." });
    }
};

const isPatron = (req, res, next) => {
    if (!req.user || req.user.role !== 'patron') {
        return res.status(403).json({ message: "Accès interdit : seul un patron peut effectuer cette action." });
    }
    next();
};

const isChauffeur = (req, res, next) => {
    if (!req.user || req.user.role !== 'chauffeur') {
        return res.status(403).json({ message: "Accès interdit : seul un chauffeur peut effectuer cette action." });
    }
    next();
};

module.exports = {
  authMiddleware,
  isPatron,
  isChauffeur
};
