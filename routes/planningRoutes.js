const express = require("express");
const router = express.Router();
const Planning = require("../models/Planning");
const User = require("../models/User"); // Pour vérifier les chauffeurs existants
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ExcelJS = require("exceljs");
const { authMiddleware } = require("../middleware/authMiddleware"); // Import middleware d'authentification

// Appliquer le middleware d'authentification à toutes les routes
router.use(authMiddleware);

// 📁 Création du dossier uploads s'il n'existe pas
const UPLOADS_DIR = "uploads/planning";
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 📦 Configuration améliorée de Multer pour les fichiers joints
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Créer dossier spécifique par course si ID est fourni
    const courseDir = req.params.id 
      ? path.join(UPLOADS_DIR, req.params.id)
      : UPLOADS_DIR;
    
    if (!fs.existsSync(courseDir)) {
      fs.mkdirSync(courseDir, { recursive: true });
    }
    
    cb(null, courseDir);
  },
  filename: function (req, file, cb) {
    // Nettoyer le nom du fichier et ajouter un timestamp
    const filename = file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);
    cb(null, `${name}-${Date.now()}${ext}`);
  }
});

// Filtrer les types de fichiers autorisés
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf', 
    'image/jpeg', 
    'image/png', 
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Type de fichier non autorisé. Seuls PDF, JPEG, PNG, JPG et DOC/DOCX sont acceptés."), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // Limite de 10 Mo
});

// Middleware de gestion des erreurs Multer
const handleMulterErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: "Fichier trop volumineux (max: 10 Mo)" });
    }
    return res.status(400).json({ error: `Erreur d'upload: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

// ==================== ROUTES PRINCIPALES ====================

/**
 * ✅ POST / - Ajouter une course
 * Crée une nouvelle course de transport
 */
router.post("/", async (req, res) => {
  try {
    const { 
      nom, prenom, depart, arrive, heure, description, date, 
      chauffeur, entrepriseId, caisseSociale, color, telephone
    } = req.body;

    // Validation des champs requis
    if (!nom || !prenom || !depart || !arrive || !heure || !date || !entrepriseId) {
      return res.status(400).json({ error: "⚠️ Les champs marqués d'un astérisque sont obligatoires." });
    }

    // Validation du format de date
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: "⚠️ Format de date invalide. Utilisez YYYY-MM-DD." });
    }

    // Validation du format de l'heure
    const heureRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!heureRegex.test(heure)) {
      return res.status(400).json({ error: "⚠️ Format d'heure invalide. Utilisez HH:MM (24h)." });
    }

    // Construction de l'objet course avec des valeurs par défaut sécurisées
    const newCourse = new Planning({
      entrepriseId,
      nom: nom.trim(),
      prenom: prenom.trim(),
      depart: depart.trim(),
      arrive: arrive.trim(),
      heure,
      description: description || "",
      date,
      chauffeur: chauffeur || "Patron",
      statut: "En attente",
      caisseSociale: caisseSociale || "",
      color: color || "#5E35B1", // Couleur par défaut
      telephone: telephone || "",
      createdAt: new Date()
    });

    await newCourse.save();
    res.status(201).json({ 
      success: true,
      message: "✅ Course ajoutée avec succès", 
      course: newCourse 
    });
  } catch (err) {
    console.error("❌ Erreur ajout course :", err);
    res.status(500).json({ 
      success: false,
      error: "Une erreur est survenue lors de l'ajout de la course." 
    });
  }
});

/**
 * ✅ GET / - Récupérer toutes les courses d'une entreprise
 * Supporte la pagination, filtrage et tri
 */
router.get("/", async (req, res) => {
  try {
    const { 
      entrepriseId, 
      page = 1, 
      limit = 50, 
      search, 
      statut, 
      chauffeur, 
      dateDebut, 
      dateFin,
      sortBy = "date",
      sortOrder = "asc"
    } = req.query;
    
    if (!entrepriseId) {
      return res.status(400).json({ 
        success: false,
        error: "❌ entrepriseId requis" 
      });
    }

    // Construction du filtre de base
    const filter = { entrepriseId };
    
    // Ajout de filtres conditionnels
    if (statut) {
      filter.statut = statut;
    }
    
    if (chauffeur) {
      filter.chauffeur = chauffeur;
    }
    
    // Filtre par période
    if (dateDebut || dateFin) {
      filter.date = {};
      if (dateDebut) filter.date.$gte = dateDebut;
      if (dateFin) filter.date.$lte = dateFin;
    }
    
    // Recherche textuelle
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { nom: searchRegex },
        { prenom: searchRegex },
        { depart: searchRegex },
        { arrive: searchRegex },
        { description: searchRegex },
        { chauffeur: searchRegex }
      ];
    }
    
    // Préparation du tri
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Calcul pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Exécution de la requête avec pagination
    const [courses, total] = await Promise.all([
      Planning.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Planning.countDocuments(filter)
    ]);
    
    // Métadonnées de pagination
    const totalPages = Math.ceil(total / parseInt(limit));
    
    res.status(200).json({
      success: true,
      courses,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages
      }
    });
  } catch (err) {
    console.error("❌ Erreur récupération planning :", err);
    res.status(500).json({ 
      success: false,
      error: "Une erreur est survenue lors de la récupération des courses." 
    });
  }
});

/**
 * ✅ GET /chauffeur/:chauffeurNom - Récupérer le planning d'un chauffeur
 * Récupère les courses assignées à un chauffeur spécifique
 */
router.get("/chauffeur/:chauffeurNom", async (req, res) => {
  try {
    const { entrepriseId, page = 1, limit = 50, dateDebut, dateFin, statut } = req.query;
    const chauffeurNom = decodeURIComponent(req.params.chauffeurNom);
    
    if (!entrepriseId) {
      return res.status(400).json({ 
        success: false,
        error: "❌ entrepriseId requis" 
      });
    }

    // Construction du filtre
    const filter = {
      entrepriseId,
      chauffeur: { $regex: new RegExp(`^${chauffeurNom}$`, "i") }
    };
    
    // Filtre par statut
    if (statut) {
      filter.statut = statut;
    }
    
    // Filtre par période
    if (dateDebut || dateFin) {
      filter.date = {};
      if (dateDebut) filter.date.$gte = dateDebut;
      if (dateFin) filter.date.$lte = dateFin;
    }
    
    // Calcul pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Exécution requête avec pagination
    const [courses, total] = await Promise.all([
      Planning.find(filter)
        .sort({ date: 1, heure: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Planning.countDocuments(filter)
    ]);
    
    // Métadonnées de pagination
    const totalPages = Math.ceil(total / parseInt(limit));

    res.status(200).json({
      success: true,
      courses,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages
      }
    });
  } catch (err) {
    console.error("❌ Erreur récupération planning chauffeur :", err);
    res.status(500).json({ 
      success: false,
      error: "Une erreur est survenue lors de la récupération du planning." 
    });
  }
});

/**
 * ✅ GET /stats - Récupérer les statistiques des courses
 * Retourne des statistiques agrégées sur les courses
 */
router.get("/stats", async (req, res) => {
  try {
    const { entrepriseId, periode = 'jour' } = req.query;
    
    if (!entrepriseId) {
      return res.status(400).json({ 
        success: false,
        error: "❌ entrepriseId requis" 
      });
    }
    
    // Déterminer les bornes de date selon la période
    const maintenant = new Date();
    let dateDebut;
    
    switch (periode) {
      case 'jour':
        dateDebut = new Date(maintenant);
        dateDebut.setHours(0, 0, 0, 0);
        break;
      case 'semaine':
        dateDebut = new Date(maintenant);
        dateDebut.setDate(maintenant.getDate() - maintenant.getDay());
        dateDebut.setHours(0, 0, 0, 0);
        break;
      case 'mois':
        dateDebut = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
        break;
      default:
        dateDebut = new Date(maintenant);
        dateDebut.setHours(0, 0, 0, 0);
    }
    
    // Format des dates pour la requête
    const dateDebutStr = dateDebut.toISOString().split('T')[0];
    const dateFinStr = maintenant.toISOString().split('T')[0];
    
    // Statistiques des courses par statut
    const statsPipeline = [
      { 
        $match: { 
          entrepriseId,
          date: { $gte: dateDebutStr, $lte: dateFinStr }
        }
      },
      {
        $group: {
          _id: "$statut",
          count: { $sum: 1 }
        }
      }
    ];
    
    // Statistiques par chauffeur
    const chauffeursPipeline = [
      { 
        $match: { 
          entrepriseId,
          date: { $gte: dateDebutStr, $lte: dateFinStr }
        }
      },
      {
        $group: {
          _id: "$chauffeur",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ];
    
    // Exécuter les requêtes d'agrégation
    const [statsByStatus, statsByChauffeur] = await Promise.all([
      Planning.aggregate(statsPipeline),
      Planning.aggregate(chauffeursPipeline)
    ]);
    
    // Formatage des résultats
    const statusStats = {};
    statsByStatus.forEach(stat => {
      statusStats[stat._id || 'Non défini'] = stat.count;
    });
    
    const chauffeurStats = {};
    statsByChauffeur.forEach(stat => {
      chauffeurStats[stat._id || 'Non défini'] = stat.count;
    });
    
    res.status(200).json({
      success: true,
      periode,
      dateDebut: dateDebutStr,
      dateFin: dateFinStr,
      parStatut: statusStats,
      parChauffeur: chauffeurStats,
      total: statsByStatus.reduce((total, stat) => total + stat.count, 0)
    });
  } catch (err) {
    console.error("❌ Erreur récupération statistiques :", err);
    res.status(500).json({ 
      success: false,
      error: "Une erreur est survenue lors de la récupération des statistiques." 
    });
  }
});

/**
 * ✅ PUT /send/:id - Envoyer une course à un chauffeur
 * Assigne une course à un chauffeur spécifique
 */
router.put("/send/:id", async (req, res) => {
  try {
    const { chauffeur, color, notes } = req.body;
    
    if (!chauffeur) {
      return res.status(400).json({ 
        success: false,
        error: "⚠️ Le chauffeur doit être spécifié." 
      });
    }

    // Trouver la course avant la mise à jour
    const course = await Planning.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ 
        success: false,
        message: "❌ Course non trouvée." 
      });
    }
    
    // Construire l'objet de mise à jour
    const updateData = { 
      chauffeur, 
      statut: "Assignée",
      updatedAt: new Date()
    };
    
    // Ajouter les champs optionnels s'ils sont fournis
    if (color) updateData.color = color;
    if (notes) {
      updateData.notes = course.notes 
        ? `${course.notes}\n---\n${new Date().toLocaleString()}: ${notes}`
        : `${new Date().toLocaleString()}: ${notes}`;
    }

    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.status(200).json({ 
      success: true,
      message: "🚖 Course assignée à " + chauffeur, 
      course: updatedCourse 
    });
  } catch (err) {
    console.error("❌ Erreur envoi au chauffeur :", err);
    res.status(500).json({ 
      success: false,
      error: "Une erreur est survenue lors de l'assignation de la course." 
    });
  }
});

/**
 * ✅ PUT /color/:id - Modifier la couleur d'une course
 * Change uniquement la couleur d'une course
 */
router.put("/color/:id", async (req, res) => {
  const { color } = req.body;
  
  if (!color) {
    return res.status(400).json({ 
      success: false,
      error: "⚠️ La couleur doit être spécifiée." 
    });
  }
  
  try {
    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      { 
        color,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!updatedCourse) {
      return res.status(404).json({ 
        success: false,
        message: "❌ Course non trouvée." 
      });
    }
    
    res.status(200).json({ 
      success: true,
      message: "🎨 Couleur mise à jour", 
      course: updatedCourse 
    });
  } catch (err) {
    console.error("❌ Erreur mise à jour couleur :", err);
    res.status(500).json({ 
      success: false,
      error: "Une erreur est survenue lors de la mise à jour de la couleur." 
    });
  }
});

/**
 * ✅ PUT /status/:id - Mettre à jour le statut d'une course
 * Endpoint général pour changer le statut
 */
router.put("/status/:id", async (req, res) => {
  try {
    const { statut, notes } = req.body;
    
    if (!statut) {
      return res.status(400).json({ 
        success: false,
        error: "⚠️ Le statut doit être spécifié." 
      });
    }
    
    // Valider que le statut est valide
    const statutsValides = ["En attente", "Assignée", "En cours", "Terminée", "Annulée"];
    if (!statutsValides.includes(statut)) {
      return res.status(400).json({ 
        success: false,
        error: "⚠️ Statut invalide. Valeurs possibles: " + statutsValides.join(", ")
      });
    }
    
    // Trouver la course avant la mise à jour
    const course = await Planning.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ 
        success: false,
        message: "❌ Course non trouvée." 
      });
    }

    // Construire l'objet de mise à jour
    const updateData = { 
      statut,
      updatedAt: new Date()
    };
    
    // Ajouter des notes si fournies
    if (notes) {
      updateData.notes = course.notes 
        ? `${course.notes}\n---\n${new Date().toLocaleString()}: ${notes}`
        : `${new Date().toLocaleString()}: ${notes}`;
    }
    
    // Ajouter automatiquement la date de début/fin selon le statut
    if (statut === "En cours" && !course.dateDebut) {
      updateData.dateDebut = new Date();
    } else if (statut === "Terminée" && !course.dateFin) {
      updateData.dateFin = new Date();
    }

    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    // Message personnalisé selon le statut
    let message;
    switch (statut) {
      case "En cours": 
        message = "🚕 Course démarrée"; 
        break;
      case "Terminée": 
        message = "✅ Course terminée"; 
        break;
      case "Annulée": 
        message = "❌ Course annulée"; 
        break;
      default: 
        message = `🔄 Statut mis à jour: ${statut}`;
    }

    res.status(200).json({ 
      success: true,
      message, 
      course: updatedCourse 
    });
  } catch (err) {
    console.error("❌ Erreur mise à jour statut :", err);
    res.status(500).json({ 
      success: false,
      error: "Une erreur est survenue lors de la mise à jour du statut." 
    });
  }
});

/**
 * ✅ PUT /price/:id - Modifier le prix d'une course
 * Met à jour le montant facturé pour une course
 */
router.put("/price/:id", async (req, res) => {
  try {
    const { prix } = req.body;
    
    if (prix === undefined || prix === null) {
      return res.status(400).json({ 
        success: false,
        error: "⚠️ Le prix doit être spécifié." 
      });
    }
    
    const prixNumber = parseFloat(prix);
    if (isNaN(prixNumber) || prixNumber < 0) {
      return res.status(400).json({ 
        success: false,
        error: "⚠️ Le prix doit être un nombre positif." 
      });
    }

    const updated = await Planning.findByIdAndUpdate(
      req.params.id,
      { 
        prix: prixNumber,
        updatedAt: new Date()
      }, 
      { new: true }
    );
    
    if (!updated) {
      return res.status(404).json({ 
        success: false,
        message: "❌ Course non trouvée." 
      });
    }

    res.status(200).json({ 
      success: true,
      message: "💰 Prix mis à jour", 
      course: updated 
    });
  } catch (err) {
    console.error("❌ Erreur mise à jour prix :", err);
    res.status(500).json({ 
      success: false,
      error: "Une erreur est survenue lors de la mise à jour du prix." 
    });
  }
});

/**
 * ✅ DELETE /:id - Supprimer une course
 * Supprime une course et tous ses fichiers associés
 */
router.delete("/:id", async (req, res) => {
  try {
    // Récupérer la course avant suppression pour pouvoir supprimer les fichiers
    const course = await Planning.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ 
        success: false,
        message: "❌ Course non trouvée." 
      });
    }
    
    // Supprimer les fichiers associés si existants
    const courseDir = path.join(UPLOADS_DIR, req.params.id);
    if (fs.existsSync(courseDir)) {
      fs.rmSync(courseDir, { recursive: true, force: true });
    }
    
    // Supprimer la course
    await Planning.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ 
      success: true,
      message: "🗑️ Course supprimée", 
      id: req.params.id 
    });
  } catch (err) {
    console.error("❌ Erreur suppression course :", err);
    res.status(500).json({ 
      success: false,
      error: "Une erreur est survenue lors de la suppression de la course." 
    });
  }
});

/**
 * ✅ POST /upload/:id - Uploader un fichier pour une course
 * Ajoute une pièce jointe à une course
 */
router.post(
  "/upload/:id", 
  upload.single("file"), 
  handleMulterErrors, 
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: "Aucun fichier envoyé." 
        });
      }
      
      // Construire le chemin relatif du fichier
      const filePath = path.join(
        "uploads/planning", 
        req.params.id, 
        req.file.filename
      ).replace(/\\/g, '/'); // Convertir backslash en slash pour la cohérence
      
      // Récupérer la course
      const course = await Planning.findById(req.params.id);
      if (!course) {
        return res.status(404).json({ 
          success: false,
          message: "❌ Course non trouvée." 
        });
      }
      
      // Ajouter le fichier à la liste des pièces jointes
      const piecesJointes = Array.isArray(course.pieceJointe) 
        ? [...course.pieceJointe, filePath]
        : [filePath];
      
      // Mettre à jour la course
      const updatedCourse = await Planning.findByIdAndUpdate(
        req.params.id,
        { 
          pieceJointe: piecesJointes,
          updatedAt: new Date()
        },
        { new: true }
      );
      
      res.status(200).json({ 
        success: true,
        message: "📎 Fichier attaché avec succès", 
        course: updatedCourse,
        file: {
          name: req.file.originalname,
          path: filePath,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
    } catch (err) {
      console.error("❌ Erreur upload fichier :", err);
      res.status(500).json({ 
        success: false,
        error: "Une erreur est survenue lors de l'upload du fichier." 
      });
    }
  }
);

/**
 * ✅ DELETE /file/:id/:fileIndex - Supprimer un fichier joint
 * Supprime une pièce jointe spécifique d'une course
 */
router.delete("/file/:id/:fileIndex", async (req, res) => {
  try {
    const { id, fileIndex } = req.params;
    const indexNum = parseInt(fileIndex);
    
    if (isNaN(indexNum) || indexNum < 0) {
      return res.status(400).json({ 
        success: false,
        error: "⚠️ Index de fichier invalide." 
      });
    }
    
    // Récupérer la course
    const course = await Planning.findById(id);
    if (!course) {
      return res.status(404).json({ 
        success: false,
        message: "❌ Course non trouvée." 
      });
    }
    
    // Vérifier que le fichier existe
    if (!Array.isArray(course.pieceJointe) || !course.pieceJointe[indexNum]) {
      return res.status(404).json({ 
        success: false,
        message: "❌ Fichier non trouvé." 
      });
    }
    
    // Récupérer le chemin du fichier et le supprimer
    const filePath = course.pieceJointe[indexNum];
    const fullPath = path.join(process.cwd(), filePath);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    
    // Supprimer la référence au fichier
    course.pieceJointe.splice(indexNum, 1);
    course.updatedAt = new Date();
    await course.save();
    
    res.status(200).json({ 
      success: true,
      message: "🗑️ Fichier supprimé", 
      course
    });
  } catch (err) {
    console.error("❌ Erreur suppression fichier :", err);
    res.status(500).json({ 
      success: false,
      error: "Une erreur est survenue lors de la suppression du fichier." 
    });
  }
});

/**
 * ✅ GET /export - Exporter les courses en Excel
 * Génère un fichier Excel avec les courses filtrées
 */
router.get("/export", async (req, res) => {
  try {
    const { 
      entrepriseId, 
      statut, 
      chauffeur, 
      dateDebut, 
      dateFin 
    } = req.query;
    
    if (!entrepriseId) {
      return res.status(400).json({ 
        success: false,
        error: "❌ entrepriseId requis" 
      });
    }
    
    // Construction du filtre
    const filter = { entrepriseId };
    
    if (statut) {
      filter.statut = statut;
    }
    
    if (chauffeur) {
      filter.chauffeur = chauffeur;
    }
    
    if (dateDebut || dateFin) {
      filter.date = {};
      if (dateDebut) filter.date.$gte = dateDebut;
      if (dateFin) filter.date.$lte = dateFin;
    }
    
    // Récupérer les courses
    const courses = await Planning.find(filter).sort({ date: 1, heure: 1 });
    
    // Créer un classeur Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "VTC Manager";
    workbook.created = new Date();
    workbook.modified = new Date();
    
    // Ajouter une feuille
    const worksheet = workbook.addWorksheet("Courses");
    
    // Définir les colonnes avec style d'en-tête
    worksheet.columns = [
      { header: "Date", key: "date", width: 12, style: { numFmt: 'dd/mm/yyyy' } },
      { header: "Heure", key: "heure", width: 8 },
      { header: "Client", key: "client", width: 25 },
      { header: "Départ", key: "depart", width: 30 },
      { header: "Arrivée", key: "arrive", width: 30 },
      { header: "Statut", key: "statut", width: 12 },
      { header: "Chauffeur", key: "chauffeur", width: 15 },
      { header: "Prix", key: "prix", width: 10, style: { numFmt: '#,##0.00 €' } },
      { header: "Caisse Sociale", key: "caisseSociale", width: 15 },
      { header: "Téléphone", key: "telephone", width: 15 },
      { header: "Description", key: "description", width: 30 },
      { header: "Créée le", key: "createdAt", width: 16 },
      { header: "Mise à jour", key: "updatedAt", width: 16 },
    ];
    
    // Style d'en-tête
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF007BFF' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    
    // Ajouter les données
    courses.forEach(course => {
      // Formater la date ISO en objet Date pour Excel
      let formattedDate = null;
      if (course.date) {
        try {
          formattedDate = new Date(course.date);
        } catch (e) {
          formattedDate = null;
        }
      }
      
      worksheet.addRow({
        date: formattedDate,
        heure: course.heure,
        client: `${course.nom} ${course.prenom}`,
        depart: course.depart,
        arrive: course.arrive,
        statut: course.statut || "En attente",
        chauffeur: course.chauffeur || "Non assigné",
        prix: course.prix || 0,
        caisseSociale: course.caisseSociale || "",
        telephone: course.telephone || "",
        description: course.description || "",
        createdAt: course.createdAt || new Date(),
        updatedAt: course.updatedAt || new Date()
      });
    });
    
    // Coloration conditionnelle par statut
    const statutColors = {
      "En attente": "FFFFA500", // Orange
      "Assignée": "FF4CAF50",   // Vert
      "En cours": "FF2196F3",   // Bleu
      "Terminée": "FF9E9E9E",   // Gris
      "Annulée": "FFF44336"     // Rouge
    };
    
    // Appliquer le formatage conditionnel
    worksheet.eachRow({ includeEmpty: false }, function(row, rowNumber) {
      if (rowNumber > 1) { // Skip header row
        const statutCell = row.getCell('statut');
        const statut = statutCell.value;
        
        if (statut && statutColors[statut]) {
          statutCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: statutColors[statut] }
          };
          statutCell.font = { color: { argb: 'FFFFFFFF' } };
        }
      }
    });
    
    // Ajouter des filtres automatiques
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 13 }
    };
    
    // Figer la première ligne
    worksheet.views = [
      { state: 'frozen', ySplit: 1, activeCell: 'A2' }
    ];
    
    // Définir les headers pour le téléchargement
    res.setHeader(
      'Content-Type', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition', 
      `attachment; filename=courses-${new Date().toISOString().split('T')[0]}.xlsx`
    );
    
    // Écrire le fichier dans la réponse
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("❌ Erreur export Excel :", err);
    res.status(500).json({ 
      success: false,
      error: "Une erreur est survenue lors de l'export Excel." 
    });
  }
});

// ==================== ROUTES DE PARTAGE DE COURSES ====================

/**
 * ✅ GET /course/:id - Récupérer les détails d'une course
 * Récupère une course pour visualisation ou partage
 */
router.get("/course/:id", async (req, res) => {
  try {
    const course = await Planning.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ 
        success: false,
        message: "❌ Course non trouvée." 
      });
    }
    
    res.status(200).json({
      success: true,
      course
    });
  } catch (err) {
    console.error("❌ Erreur récupération course :", err);
    res.status(500).json({ 
      success: false,
      error: "Une erreur est survenue lors de la récupération de la course." 
    });
  }
});

/**
 * ✅ PUT /accept/:id - Accepter une course partagée
 * Change l'entreprise et le statut d'une course partagée
 */
router.put("/accept/:id", async (req, res) => {
  try {
    const { entrepriseId, chauffeur, notes } = req.body;
    
    if (!entrepriseId) {
      return res.status(400).json({ 
        success: false,
        error: "❌ entrepriseId requis" 
      });
    }
    
    // Construire l'objet de mise à jour
    const updateData = { 
      statut: "Acceptée", 
      entrepriseId,
      updatedAt: new Date()
    };
    
    // Ajouter le chauffeur si fourni
    if (chauffeur) {
      updateData.chauffeur = chauffeur;
    }
    
    // Ajouter des notes si fournies
    if (notes) {
      const course = await Planning.findById(req.params.id);
      updateData.notes = course && course.notes 
        ? `${course.notes}\n---\n${new Date().toLocaleString()}: ${notes}`
        : `${new Date().toLocaleString()}: ${notes}`;
    }

    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!updatedCourse) {
      return res.status(404).json({ 
        success: false,
        message: "❌ Course non trouvée." 
      });
    }
    
    res.status(200).json({ 
      success: true,
      message: "✅ Course acceptée", 
      course: updatedCourse 
    });
  } catch (err) {
    console.error("❌ Erreur acceptation course :", err);
    res.status(500).json({ 
      success: false,
      error: "Une erreur est survenue lors de l'acceptation de la course." 
    });
  }
});

/**
 * ✅ PUT /refuse/:id - Refuser une course partagée
 * Change le statut d'une course partagée en "Refusée"
 */
router.put("/refuse/:id", async (req, res) => {
  try {
    const { entrepriseId, notes } = req.body;
    
    if (!entrepriseId) {
      return res.status(400).json({ 
        success: false,
        error: "❌ entrepriseId requis" 
      });
    }
    
    // Construire l'objet de mise à jour
    const updateData = { 
      statut: "Refusée", 
      entrepriseId,
      updatedAt: new Date()
    };
    
    // Ajouter des notes si fournies
    if (notes) {
      const course = await Planning.findById(req.params.id);
      updateData.notes = course && course.notes 
        ? `${course.notes}\n---\n${new Date().toLocaleString()}: ${notes}`
        : `${new Date().toLocaleString()}: ${notes}`;
    }

    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!updatedCourse) {
      return res.status(404).json({ 
        success: false,
        message: "❌ Course non trouvée." 
      });
    }
    
    res.status(200).json({ 
      success: true,
      message: "❌ Course refusée", 
      course: updatedCourse 
    });
  } catch (err) {
    console.error("❌ Erreur refus course :", err);
    res.status(500).json({ 
      success: false,
      error: "Une erreur est survenue lors du refus de la course." 
    });
  }
});

module.exports = router;