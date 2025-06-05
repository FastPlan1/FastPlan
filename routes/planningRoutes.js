const express = require("express");
const router = express.Router();
const Planning = require("../models/Planning");
const multer = require("multer");
const path = require("path");
const ExcelJS = require("exceljs");
const fs = require("fs");

// Fonction utilitaire pour échapper les caractères spéciaux regex
function escapeRegExp(string) {
  if (!string || typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Fonction utilitaire pour valider les données d'entrée
function validateInputData(data) {
  const errors = [];
  
  // Validation des champs requis
  const requiredFields = ['nom', 'prenom', 'depart', 'arrive', 'heure', 'date', 'entrepriseId'];
  requiredFields.forEach(field => {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      errors.push(`Le champ ${field} est requis`);
    }
  });
  
  // Validation du format de date
  if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push("Format de date invalide (YYYY-MM-DD)");
  }
  
  // Validation du format d'heure
  if (data.heure && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(data.heure)) {
    errors.push("Format d'heure invalide (HH:MM)");
  }
  
  // Validation de la couleur
  if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
    errors.push("Format de couleur invalide");
  }
  
  return errors;
}

// 📦 Configuration de Multer pour les fichiers joints
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "uploads/";
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `piece-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accepter seulement les images et PDFs
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé'));
    }
  }
});

// ==================== ROUTES ====================

// ✅ Ajouter une course
router.post("/", async (req, res) => {
  try {
    const { nom, prenom, depart, arrive, heure, description, date, chauffeur, entrepriseId, caisseSociale, color, telephone } = req.body;

    // Validation des données d'entrée
    const validationErrors = validateInputData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: "⚠️ Erreurs de validation",
        details: validationErrors
      });
    }

    // Validation de la date dans le futur (optionnel)
    const courseDateTime = new Date(`${date}T${heure}:00.000Z`);
    if (isNaN(courseDateTime.getTime())) {
      return res.status(400).json({ error: "Date ou heure invalide" });
    }

    const newCourse = new Planning({
      entrepriseId,
      nom: nom.trim(),
      prenom: prenom.trim(),
      depart: depart.trim(),
      arrive: arrive.trim(),
      heure,
      description: description ? description.trim() : "",
      date,
      chauffeur: chauffeur ? chauffeur.trim() : "",
      telephone: telephone ? telephone.trim() : "",
      statut: "En attente",
      caisseSociale: caisseSociale ? caisseSociale.trim() : "",
      color: color || "#5E35B1",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedCourse = await newCourse.save();
    
    res.status(201).json({ 
      message: "✅ Course ajoutée avec succès", 
      course: savedCourse 
    });
  } catch (err) {
    console.error("❌ Erreur ajout course :", err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        error: "Erreurs de validation", 
        details: errors 
      });
    }
    
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "Données invalides" });
    }
    
    res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

// ✅ Récupérer toutes les courses d'une entreprise avec filtres
router.get("/", async (req, res) => {
  try {
    const { entrepriseId, date, chauffeur, statut } = req.query;
    
    if (!entrepriseId) {
      return res.status(400).json({ error: "❌ entrepriseId requis" });
    }

    // Construction du filtre
    const filter = { entrepriseId };
    
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      filter.date = date;
    }
    
    if (chauffeur && chauffeur !== "all" && chauffeur.trim()) {
      const escapedChauffeur = escapeRegExp(chauffeur.trim());
      filter.chauffeur = new RegExp(`^${escapedChauffeur}$`, "i");
    }
    
    if (statut && statut !== "all") {
      filter.statut = statut;
    }

    const courses = await Planning.find(filter)
      .sort({ date: 1, heure: 1 })
      .lean(); // Utiliser lean() pour de meilleures performances

    // S'assurer que tous les objets ont les champs nécessaires
    const coursesFormatted = courses.map(course => ({
      ...course,
      name: `${course.prenom || ''} ${course.nom || ''}`.trim() || 'Client sans nom',
      pieceJointe: Array.isArray(course.pieceJointe) ? course.pieceJointe : [],
      telephone: course.telephone || '',
      description: course.description || '',
      notes: course.notes || ''
    }));

    res.status(200).json(coursesFormatted);
  } catch (err) {
    console.error("❌ Erreur récupération planning :", err);
    res.status(500).json({ error: "Erreur lors de la récupération des courses" });
  }
});

// ✅ Récupérer le planning d'un chauffeur dans son entreprise
router.get("/chauffeur/:chauffeurNom", async (req, res) => {
  try {
    const { entrepriseId, dateStart, dateEnd } = req.query;
    const chauffeurNom = decodeURIComponent(req.params.chauffeurNom);
    
    if (!entrepriseId) {
      return res.status(400).json({ error: "❌ entrepriseId requis" });
    }

    if (!chauffeurNom || !chauffeurNom.trim()) {
      return res.status(400).json({ error: "❌ Nom du chauffeur requis" });
    }

    // Construction du filtre avec échappement des caractères spéciaux
    const filter = {
      entrepriseId,
      chauffeur: { $regex: new RegExp(`^${escapeRegExp(chauffeurNom.trim())}$`, "i") },
    };

    // Filtre par période si spécifié
    if (dateStart && dateEnd) {
      // Validation des dates
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStart) || !/^\d{4}-\d{2}-\d{2}$/.test(dateEnd)) {
        return res.status(400).json({ error: "Format de date invalide" });
      }
      filter.date = { $gte: dateStart, $lte: dateEnd };
    } else if (dateStart) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStart)) {
        return res.status(400).json({ error: "Format de date de début invalide" });
      }
      filter.date = { $gte: dateStart };
    } else if (dateEnd) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateEnd)) {
        return res.status(400).json({ error: "Format de date de fin invalide" });
      }
      filter.date = { $lte: dateEnd };
    }

    const courses = await Planning.find(filter)
      .sort({ date: 1, heure: 1 })
      .lean();

    // Formater les courses avec tous les champs nécessaires
    const coursesFormatted = courses.map(course => ({
      ...course,
      name: `${course.prenom || ''} ${course.nom || ''}`.trim() || 'Client sans nom',
      pieceJointe: Array.isArray(course.pieceJointe) ? course.pieceJointe : [],
      telephone: course.telephone || '',
      description: course.description || '',
      notes: course.notes || '',
      depart: course.depart || 'Adresse de départ non spécifiée',
      arrive: course.arrive || 'Adresse d\'arrivée non spécifiée'
    }));

    res.status(200).json(coursesFormatted);
  } catch (err) {
    console.error("❌ Erreur récupération planning chauffeur :", err);
    
    if (err.message.includes('Invalid regular expression')) {
      return res.status(400).json({ error: "Nom de chauffeur contient des caractères invalides" });
    }
    
    res.status(500).json({ error: "Erreur lors de la récupération du planning" });
  }
});

// ✅ Envoyer une course à un chauffeur (affectation)
router.put("/send/:id", async (req, res) => {
  try {
    const { chauffeur, color } = req.body;
    
    if (!chauffeur || !chauffeur.trim()) {
      return res.status(400).json({ error: "⚠️ Le chauffeur doit être spécifié." });
    }

    // Validation de l'ID
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    const updateData = { 
      chauffeur: chauffeur.trim(), 
      statut: "Assignée",
      updatedAt: new Date()
    };
    
    if (color && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
      updateData.color = color;
    }

    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedCourse) {
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }

    res.status(200).json({ 
      message: "🚖 Course envoyée !", 
      course: updatedCourse 
    });
  } catch (err) {
    console.error("❌ Erreur envoi au chauffeur :", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "ID de course invalide" });
    }
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: errors.join(', ') });
    }
    
    res.status(500).json({ error: "Erreur lors de l'assignation" });
  }
});

// ✅ Modifier uniquement la couleur d'une course
router.put("/color/:id", async (req, res) => {
  try {
    const { color } = req.body;
    
    if (!color || !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
      return res.status(400).json({ error: "⚠️ Couleur valide requise (format hex)." });
    }

    // Validation de l'ID
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    console.log("🎨 Requête reçue pour changement de couleur :", req.params.id, color);
    
    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      { 
        color,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedCourse) {
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }
    
    res.status(200).json({ 
      message: "🎨 Couleur mise à jour", 
      course: updatedCourse 
    });
  } catch (err) {
    console.error("❌ Erreur mise à jour couleur :", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "ID de course invalide" });
    }
    
    res.status(500).json({ error: "Erreur lors de la mise à jour de la couleur" });
  }
});

// ✅ Marquer une course comme terminée
router.put("/finish/:id", async (req, res) => {
  try {
    // Validation de l'ID
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    const updateData = { 
      statut: "Terminée",
      dateFin: new Date(),
      updatedAt: new Date()
    };

    // Si ce n'était pas encore en cours, marquer aussi le début
    const currentCourse = await Planning.findById(req.params.id);
    if (!currentCourse) {
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }

    if (!currentCourse.dateDebut) {
      updateData.dateDebut = new Date();
    }

    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    console.log(`🔔 ALERTE : Course terminée par ${updatedCourse.chauffeur} à ${new Date().toLocaleString()}`);
    
    res.status(200).json({ 
      message: "✅ Course terminée", 
      course: updatedCourse 
    });
  } catch (err) {
    console.error("❌ Erreur fin de course :", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "ID de course invalide" });
    }
    
    res.status(500).json({ error: "Erreur lors de la finalisation de la course" });
  }
});

// ✅ Récupérer les courses terminées d'une entreprise avec pagination
router.get("/terminees", async (req, res) => {
  try {
    const { entrepriseId, page = 1, limit = 50, dateStart, dateEnd } = req.query;
    
    if (!entrepriseId) {
      return res.status(400).json({ error: "❌ entrepriseId requis" });
    }

    const filter = { 
      statut: "Terminée", 
      entrepriseId 
    };

    // Filtre par période si spécifié
    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart && /^\d{4}-\d{2}-\d{2}$/.test(dateStart)) {
        filter.date.$gte = dateStart;
      }
      if (dateEnd && /^\d{4}-\d{2}-\d{2}$/.test(dateEnd)) {
        filter.date.$lte = dateEnd;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [courses, total] = await Promise.all([
      Planning.find(filter)
        .sort({ date: -1, heure: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Planning.countDocuments(filter)
    ]);

    res.status(200).json({
      courses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error("❌ Erreur récupération historique :", err);
    res.status(500).json({ error: "Erreur lors de la récupération de l'historique" });
  }
});

// ✅ Modifier le prix d'une course
router.put("/price/:id", async (req, res) => {
  try {
    const { prix } = req.body;
    
    if (typeof prix !== 'number' || prix < 0) {
      return res.status(400).json({ error: "⚠️ Le prix doit être un nombre positif." });
    }

    // Validation de l'ID
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    const updated = await Planning.findByIdAndUpdate(
      req.params.id, 
      { 
        prix: parseFloat(prix),
        updatedAt: new Date()
      }, 
      { new: true, runValidators: true }
    );
    
    if (!updated) {
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }

    res.status(200).json({ 
      message: "💰 Prix mis à jour", 
      course: updated 
    });
  } catch (err) {
    console.error("❌ Erreur mise à jour prix :", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "ID de course invalide" });
    }
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: errors.join(', ') });
    }
    
    res.status(500).json({ error: "Erreur lors de la mise à jour du prix" });
  }
});

// ✅ Supprimer une course
router.delete("/:id", async (req, res) => {
  try {
    // Validation de l'ID
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    const deleted = await Planning.findByIdAndDelete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }

    // Supprimer les fichiers associés
    if (deleted.pieceJointe && Array.isArray(deleted.pieceJointe) && deleted.pieceJointe.length > 0) {
      deleted.pieceJointe.forEach(filePath => {
        const fullPath = path.join(__dirname, "..", filePath);
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch (fileErr) {
            console.error("❌ Erreur suppression fichier :", fileErr);
          }
        }
      });
    }
    
    res.status(200).json({ 
      message: "🗑️ Course supprimée", 
      course: deleted 
    });
  } catch (err) {
    console.error("❌ Erreur suppression course :", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "ID de course invalide" });
    }
    
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// ✅ Upload de pièce jointe
router.post("/upload/:id", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "❌ Aucun fichier envoyé." });
    }

    // Validation de l'ID
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      // Supprimer le fichier uploadé si l'ID est invalide
      const fullPath = path.join(__dirname, "..", "uploads", req.file.filename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      return res.status(400).json({ error: "ID de course invalide" });
    }

    const filePath = `/uploads/${req.file.filename}`;
    
    const course = await Planning.findById(req.params.id);
    if (!course) {
      // Supprimer le fichier uploadé si la course n'existe pas
      const fullPath = path.join(__dirname, "..", "uploads", req.file.filename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }

    // Ajouter le nouveau fichier à la liste
    course.pieceJointe = Array.isArray(course.pieceJointe)
      ? [...course.pieceJointe, filePath]
      : [filePath];
    
    course.updatedAt = new Date();
    await course.save();
    
    res.status(200).json({ 
      message: "📎 Fichier attaché avec succès", 
      course,
      uploadedFile: {
        path: filePath,
        originalName: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (err) {
    console.error("❌ Erreur upload fichier :", err);
    
    // Nettoyer le fichier en cas d'erreur
    if (req.file) {
      const fullPath = path.join(__dirname, "..", "uploads", req.file.filename);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (cleanupErr) {
          console.error("❌ Erreur nettoyage fichier :", cleanupErr);
        }
      }
    }
    
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "ID de course invalide" });
    }
    
    res.status(500).json({ error: "Erreur lors de l'upload du fichier" });
  }
});

// ✅ Récupérer les détails d'une course pour le partage
router.get("/course/:id", async (req, res) => {
  try {
    // Validation de l'ID
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    const course = await Planning.findById(req.params.id).lean();
    
    if (!course) {
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }
    
    // Formater la course avec tous les champs nécessaires
    const courseFormatted = {
      ...course,
      name: `${course.prenom || ''} ${course.nom || ''}`.trim() || 'Client sans nom',
      pieceJointe: Array.isArray(course.pieceJointe) ? course.pieceJointe : [],
      telephone: course.telephone || '',
      description: course.description || '',
      notes: course.notes || ''
    };
    
    res.status(200).json(courseFormatted);
  } catch (err) {
    console.error("❌ Erreur récupération course :", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "ID de course invalide" });
    }
    
    res.status(500).json({ error: "Erreur lors de la récupération de la course" });
  }
});

// ✅ Accepter une course partagée via lien (changer entreprise et statut)
router.put("/accept/:id", async (req, res) => {
  try {
    const { entrepriseId } = req.body;
    
    if (!entrepriseId) {
      return res.status(400).json({ error: "❌ entrepriseId requis" });
    }

    // Validation de l'ID
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      { 
        statut: "Acceptée", 
        entrepriseId,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedCourse) {
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }
    
    res.status(200).json({ 
      message: "✅ Course acceptée", 
      course: updatedCourse 
    });
  } catch (err) {
    console.error("❌ Erreur acceptation course :", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "ID de course invalide" });
    }
    
    res.status(500).json({ error: "Erreur lors de l'acceptation de la course" });
  }
});

// ✅ Refuser une course partagée via lien
router.put("/refuse/:id", async (req, res) => {
  try {
    const { entrepriseId } = req.body;
    
    if (!entrepriseId) {
      return res.status(400).json({ error: "❌ entrepriseId requis" });
    }

    // Validation de l'ID
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      { 
        statut: "Refusée", 
        entrepriseId,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedCourse) {
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }
    
    res.status(200).json({ 
      message: "❌ Course refusée", 
      course: updatedCourse 
    });
  } catch (err) {
    console.error("❌ Erreur refus course :", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "ID de course invalide" });
    }
    
    res.status(500).json({ error: "Erreur lors du refus de la course" });
  }
});

// ✅ Mettre à jour une course complète
router.put("/:id", async (req, res) => {
  try {
    // Validation de l'ID
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    const allowedUpdates = [
      'nom', 'prenom', 'telephone', 'caisseSociale', 
      'depart', 'arrive', 'date', 'heure', 'statut', 
      'chauffeur', 'color', 'prix', 'description', 'notes'
    ];
    
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key) && req.body[key] !== undefined) {
        // Nettoyer les strings
        if (typeof req.body[key] === 'string') {
          updates[key] = req.body[key].trim();
        } else {
          updates[key] = req.body[key];
        }
      }
    });
    
    updates.updatedAt = new Date();

    // Validation des données avant mise à jour
    if (updates.date && !/^\d{4}-\d{2}-\d{2}$/.test(updates.date)) {
      return res.status(400).json({ error: "Format de date invalide" });
    }
    
    if (updates.heure && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(updates.heure)) {
      return res.status(400).json({ error: "Format d'heure invalide" });
    }
    
    if (updates.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(updates.color)) {
      return res.status(400).json({ error: "Format de couleur invalide" });
    }

    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!updatedCourse) {
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }
    
    res.status(200).json({ 
      message: "✅ Course mise à jour", 
      course: updatedCourse 
    });
  } catch (err) {
    console.error("❌ Erreur mise à jour course :", err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: errors.join(', ') });
    }
    
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "ID de course invalide" });
    }
    
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

// ✅ Marquer une course comme en cours
router.put("/start/:id", async (req, res) => {
  try {
    // Validation de l'ID
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      { 
        statut: "En cours",
        dateDebut: new Date(),
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedCourse) {
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }
    
    res.status(200).json({ 
      message: "🚗 Course démarrée", 
      course: updatedCourse 
    });
  } catch (err) {
    console.error("❌ Erreur démarrage course :", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "ID de course invalide" });
    }
    
    res.status(500).json({ error: "Erreur lors du démarrage de la course" });
  }
});

module.exports = router;