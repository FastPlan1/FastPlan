const express = require("express");
const router = express.Router();
const Planning = require("../models/Planning");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Fonction utilitaire pour échapper les caractères spéciaux regex
function escapeRegExp(string) {
  if (!string || typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Fonction utilitaire pour valider les données d'entrée
function validateInputData(data) {
  const errors = [];
  
  console.log("🔍 VALIDATION - Données reçues :", JSON.stringify(data, null, 2));
  
  // ✅ VALIDATION DES CHAMPS REQUIS SEULEMENT
  const requiredFields = [
    { field: 'nom', label: 'Nom' },
    { field: 'prenom', label: 'Prénom' },
    { field: 'depart', label: 'Adresse de départ' },
    { field: 'arrive', label: 'Adresse d\'arrivée' },
    { field: 'date', label: 'Date' },
    { field: 'heure', label: 'Heure' },
    { field: 'entrepriseId', label: 'ID entreprise' }
  ];
  
  requiredFields.forEach(({ field, label }) => {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      errors.push(`${label} est requis`);
      console.log(`❌ VALIDATION - Champ manquant: ${field}`);
    }
  });
  
  // Validation du format de date
  if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push("Format de date invalide (YYYY-MM-DD)");
    console.log(`❌ VALIDATION - Date invalide: ${data.date}`);
  }
  
  // Validation du format d'heure
  if (data.heure && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(data.heure)) {
    errors.push("Format d'heure invalide (HH:MM)");
    console.log(`❌ VALIDATION - Heure invalide: ${data.heure}`);
  }
  
  // Validation de la couleur (optionnelle)
  if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
    errors.push("Format de couleur invalide");
    console.log(`❌ VALIDATION - Couleur invalide: ${data.color}`);
  }
  
  console.log(`✅ VALIDATION - ${errors.length} erreurs trouvées:`, errors);
  return errors;
}

// 📦 Configuration de Multer pour les fichiers joints (optionnel)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "uploads/";
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
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

// ✅ AJOUTER UNE COURSE (SIMPLIFIÉE)
router.post("/", async (req, res) => {
  try {
    console.log("📝 POST /planning - Création d'une nouvelle course");
    
    const { nom, prenom, depart, arrive, heure, date, description, color, entrepriseId } = req.body;

    // Validation des données d'entrée
    const validationErrors = validateInputData(req.body);
    if (validationErrors.length > 0) {
      console.log("❌ ERREURS DE VALIDATION:", validationErrors);
      return res.status(400).json({ 
        error: "Erreurs de validation",
        details: validationErrors
      });
    }

    // Validation de la date dans le futur (optionnel - juste warning)
    try {
      const courseDateTime = new Date(`${date}T${heure}:00.000Z`);
      if (isNaN(courseDateTime.getTime())) {
        console.log("⚠️ Date ou heure invalide");
        return res.status(400).json({ error: "Date ou heure invalide" });
      }
    } catch (error) {
      console.log("⚠️ Erreur parsing date/heure:", error.message);
      return res.status(400).json({ error: "Format de date ou heure invalide" });
    }

    // ✅ CRÉATION DE LA COURSE AVEC CHAMPS ESSENTIELS SEULEMENT
    const newCourse = new Planning({
      // Champs requis
      nom: nom.trim(),
      prenom: prenom.trim(),
      depart: depart.trim(),
      arrive: arrive.trim(),
      date,
      heure,
      entrepriseId,
      
      // Champs optionnels
      description: description ? description.trim() : "",
      color: color || "#5E35B1",
      
      // Valeurs par défaut système
      statut: "En attente",
      chauffeur: "",
      pieceJointe: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log("💾 Tentative de sauvegarde:", {
      nom: newCourse.nom,
      prenom: newCourse.prenom,
      date: newCourse.date,
      heure: newCourse.heure,
      entrepriseId: newCourse.entrepriseId
    });

    const savedCourse = await newCourse.save();
    
    console.log("✅ Course sauvegardée avec succès, ID:", savedCourse._id);
    
    res.status(201).json({ 
      message: "✅ Course ajoutée avec succès", 
      course: savedCourse 
    });

  } catch (err) {
    console.error("❌ Erreur ajout course :", err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      console.log("❌ ERREURS MONGOOSE:", errors);
      return res.status(400).json({ 
        error: "Erreurs de validation Mongoose", 
        details: errors 
      });
    }
    
    if (err.name === 'CastError') {
      console.log("❌ ERREUR DE CAST:", err.message);
      return res.status(400).json({ error: "Données invalides (CastError)" });
    }

    if (err.code === 11000) {
      console.log("❌ ERREUR DUPLICATE KEY:", err.message);
      return res.status(400).json({ error: "Données dupliquées détectées" });
    }
    
    res.status(500).json({ error: "Erreur interne du serveur" });
  }
});

// ✅ RÉCUPÉRER TOUTES LES COURSES D'UNE ENTREPRISE
router.get("/", async (req, res) => {
  try {
    const { entrepriseId, date, chauffeur, statut } = req.query;
    
    if (!entrepriseId) {
      return res.status(400).json({ error: "❌ entrepriseId requis" });
    }

    console.log("📖 GET /planning - Récupération courses pour:", { entrepriseId, date, chauffeur, statut });

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
      .lean();

    // S'assurer que tous les objets ont les champs nécessaires
    const coursesFormatted = courses.map(course => ({
      ...course,
      name: `${course.prenom || ''} ${course.nom || ''}`.trim() || 'Client sans nom',
      pieceJointe: Array.isArray(course.pieceJointe) ? course.pieceJointe : [],
      description: course.description || '',
    }));

    console.log(`✅ ${coursesFormatted.length} courses récupérées`);
    res.status(200).json(coursesFormatted);

  } catch (err) {
    console.error("❌ Erreur récupération planning :", err);
    res.status(500).json({ error: "Erreur lors de la récupération des courses" });
  }
});

// ✅ RÉCUPÉRER LE PLANNING D'UN CHAUFFEUR
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

    console.log("👤 GET /planning/chauffeur - Récupération pour:", chauffeurNom);

    // Construction du filtre avec échappement des caractères spéciaux
    const filter = {
      entrepriseId,
      chauffeur: { $regex: new RegExp(`^${escapeRegExp(chauffeurNom.trim())}$`, "i") },
    };

    // Filtre par période si spécifié
    if (dateStart && dateEnd) {
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
      description: course.description || '',
      depart: course.depart || 'Adresse de départ non spécifiée',
      arrive: course.arrive || 'Adresse d\'arrivée non spécifiée'
    }));

    console.log(`✅ ${coursesFormatted.length} courses trouvées pour ${chauffeurNom}`);
    res.status(200).json(coursesFormatted);

  } catch (err) {
    console.error("❌ Erreur récupération planning chauffeur :", err);
    
    if (err.message.includes('Invalid regular expression')) {
      return res.status(400).json({ error: "Nom de chauffeur contient des caractères invalides" });
    }
    
    res.status(500).json({ error: "Erreur lors de la récupération du planning" });
  }
});

// ✅ ASSIGNER UNE COURSE À UN CHAUFFEUR
router.put("/send/:id", async (req, res) => {
  try {
    const { chauffeur, color } = req.body;
    
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    console.log("🚖 PUT /planning/send - Assignation:", { id: req.params.id, chauffeur, color });

    const updateData = { 
      chauffeur: chauffeur ? chauffeur.trim() : "", 
      statut: chauffeur ? "Assignée" : "En attente",
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

    console.log("✅ Course assignée avec succès");
    res.status(200).json({ 
      message: chauffeur ? "🚖 Course assignée !" : "❌ Assignation retirée", 
      course: updatedCourse 
    });

  } catch (err) {
    console.error("❌ Erreur assignation :", err);
    
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

// ✅ MODIFIER LA COULEUR D'UNE COURSE
router.put("/color/:id", async (req, res) => {
  try {
    const { color } = req.body;
    
    if (!color || !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
      return res.status(400).json({ error: "⚠️ Couleur valide requise (format hex)." });
    }

    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    console.log("🎨 PUT /planning/color - Changement couleur:", { id: req.params.id, color });
    
    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      { color, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!updatedCourse) {
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }
    
    console.log("✅ Couleur mise à jour");
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

// ✅ DÉMARRER UNE COURSE
router.put("/start/:id", async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    console.log("🚗 PUT /planning/start - Démarrage course:", req.params.id);

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
    
    console.log("✅ Course démarrée");
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

// ✅ TERMINER UNE COURSE
router.put("/finish/:id", async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    console.log("✅ PUT /planning/finish - Fin course:", req.params.id);

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

    console.log(`🔔 Course terminée par ${updatedCourse.chauffeur} à ${new Date().toLocaleString()}`);
    
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

// ✅ METTRE À JOUR UNE COURSE
router.put("/:id", async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    console.log("📝 PUT /planning/:id - Mise à jour course:", req.params.id);

    const allowedUpdates = [
      'nom', 'prenom', 'depart', 'arrive', 'date', 'heure', 
      'statut', 'chauffeur', 'color', 'description'
    ];
    
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key) && req.body[key] !== undefined) {
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
    
    console.log("✅ Course mise à jour");
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

// ✅ SUPPRIMER UNE COURSE
router.delete("/:id", async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    console.log("🗑️ DELETE /planning/:id - Suppression course:", req.params.id);

    const deleted = await Planning.findByIdAndDelete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }

    // Supprimer les fichiers associés si ils existent
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
    
    console.log("✅ Course supprimée");
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

// ✅ UPLOAD DE PIÈCE JOINTE (OPTIONNEL)
router.post("/upload/:id", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "❌ Aucun fichier envoyé." });
    }

    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      const fullPath = path.join(__dirname, "..", "uploads", req.file.filename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      return res.status(400).json({ error: "ID de course invalide" });
    }

    console.log("📎 POST /planning/upload - Upload fichier pour:", req.params.id);

    const filePath = `/uploads/${req.file.filename}`;
    
    const course = await Planning.findById(req.params.id);
    if (!course) {
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
    
    console.log("✅ Fichier attaché");
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

// ✅ RÉCUPÉRER LES COURSES TERMINÉES AVEC PAGINATION
router.get("/terminees", async (req, res) => {
  try {
    const { entrepriseId, page = 1, limit = 50, dateStart, dateEnd } = req.query;
    
    if (!entrepriseId) {
      return res.status(400).json({ error: "❌ entrepriseId requis" });
    }

    console.log("📊 GET /planning/terminees - Récupération historique pour:", entrepriseId);

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

    // Formater les courses pour l'historique
    const coursesFormatted = courses.map(course => ({
      ...course,
      name: `${course.prenom || ''} ${course.nom || ''}`.trim() || 'Client sans nom',
      pieceJointe: Array.isArray(course.pieceJointe) ? course.pieceJointe : [],
      description: course.description || '',
      prix: course.prix || 0
    }));

    console.log(`✅ ${coursesFormatted.length} courses terminées récupérées`);

    res.status(200).json({
      courses: coursesFormatted,
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

// ✅ MODIFIER LE PRIX D'UNE COURSE TERMINÉE
router.put("/price/:id", async (req, res) => {
  try {
    const { prix } = req.body;
    
    if (typeof prix !== 'number' || prix < 0) {
      return res.status(400).json({ error: "⚠️ Le prix doit être un nombre positif." });
    }

    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    console.log("💰 PUT /planning/price - Mise à jour prix:", { id: req.params.id, prix });

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

    console.log("✅ Prix mis à jour");
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

// ✅ RÉCUPÉRER LES DÉTAILS D'UNE COURSE
router.get("/course/:id", async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    console.log("📖 GET /planning/course/:id - Récupération détails:", req.params.id);

    const course = await Planning.findById(req.params.id).lean();
    
    if (!course) {
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }
    
    // Formater la course avec tous les champs nécessaires
    const courseFormatted = {
      ...course,
      name: `${course.prenom || ''} ${course.nom || ''}`.trim() || 'Client sans nom',
      pieceJointe: Array.isArray(course.pieceJointe) ? course.pieceJointe : [],
      description: course.description || ''
    };
    
    console.log("✅ Détails récupérés");
    res.status(200).json(courseFormatted);

  } catch (err) {
    console.error("❌ Erreur récupération course :", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "ID de course invalide" });
    }
    
    res.status(500).json({ error: "Erreur lors de la récupération de la course" });
  }
});

module.exports = router;