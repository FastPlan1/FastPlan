const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const Course = require("../models/Planning");
const { authenticateToken, authorizeRoles, checkCompanyAccess } = require("../middleware/auth");

// Créer le répertoire d'upload s'il n'existe pas
const uploadDir = path.join(__dirname, "../uploads/courses");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuration avancée de Multer
const fileFilter = (req, file, cb) => {
  // Liste des types MIME autorisés
  const allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé'), false);
  }
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Créer un sous-dossier par entreprise si disponible
    let destPath = uploadDir;
    
    if (req.user && req.user.entrepriseId) {
      const entrepriseDir = path.join(uploadDir, req.user.entrepriseId);
      if (!fs.existsSync(entrepriseDir)) {
        fs.mkdirSync(entrepriseDir, { recursive: true });
      }
      destPath = entrepriseDir;
    }
    
    cb(null, destPath);
  },
  filename: function (req, file, cb) {
    // Sécuriser le nom de fichier
    const fileExt = path.extname(file.originalname);
    const safeFileName = `course-${Date.now()}-${uuidv4()}${fileExt}`;
    cb(null, safeFileName);
  },
});

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  }
});

/**
 * @route POST /api/planning/upload/:id
 * @desc Upload un fichier pour une course
 * @access Private
 */
router.post(
  "/upload/:id",
  authenticateToken,
  authorizeRoles(['patron', 'chauffeur']),
  upload.single("file"),
  async (req, res) => {
    try {
      const courseId = req.params.id;
      
      // Vérifier que le fichier a bien été envoyé
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Aucun fichier envoyé."
        });
      }
      
      // Récupérer la course
      const course = await Course.findById(courseId);
      
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course non trouvée."
        });
      }
      
      // Vérifier que l'utilisateur a accès à cette course
      if (course.entrepriseId && course.entrepriseId.toString() !== req.user.entrepriseId) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à modifier cette course."
        });
      }
      
      // Construire le chemin du fichier
      let filePath;
      if (req.user.entrepriseId) {
        filePath = `/uploads/courses/${req.user.entrepriseId}/${req.file.filename}`;
      } else {
        filePath = `/uploads/courses/${req.file.filename}`;
      }
      
      // Mettre à jour le tableau des fichiers
      if (!course.fichiers) {
        course.fichiers = [];
      }
      
      // Ajouter des métadonnées utiles
      const fileInfo = {
        path: filePath,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.user.id,
        uploadedAt: new Date()
      };
      
      course.fichiers.push(fileInfo);
      
      // Mettre à jour la date de modification
      course.updatedAt = new Date();
      
      await course.save();
      
      res.status(200).json({
        success: true,
        message: "Fichier uploadé avec succès",
        file: fileInfo,
        course
      });
    } catch (err) {
      console.error("❌ Erreur upload fichier :", err);
      
      // Nettoyer le fichier en cas d'erreur
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      // Gérer l'erreur de type de fichier
      if (err.message === 'Type de fichier non autorisé') {
        return res.status(400).json({
          success: false,
          message: "Type de fichier non autorisé. Formats acceptés : images, PDF, Word et texte."
        });
      }
      
      // Gérer l'erreur de taille de fichier
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: "Le fichier est trop volumineux. Taille maximale : 10 MB."
        });
      }
      
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors de l'upload du fichier."
      });
    }
  }
);

/**
 * @route DELETE /api/planning/file/:courseId/:fileIndex
 * @desc Supprimer un fichier d'une course
 * @access Private
 */
router.delete(
  "/file/:courseId/:fileIndex",
  authenticateToken,
  authorizeRoles(['patron', 'chauffeur']),
  async (req, res) => {
    try {
      const { courseId, fileIndex } = req.params;
      
      // Vérifier que l'index est un nombre
      const index = parseInt(fileIndex);
      if (isNaN(index)) {
        return res.status(400).json({
          success: false,
          message: "Index de fichier invalide."
        });
      }
      
      // Récupérer la course
      const course = await Course.findById(courseId);
      
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course non trouvée."
        });
      }
      
      // Vérifier que l'utilisateur a accès à cette course
      if (course.entrepriseId && course.entrepriseId.toString() !== req.user.entrepriseId) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à modifier cette course."
        });
      }
      
      // Vérifier que l'index est valide
      if (!course.fichiers || index < 0 || index >= course.fichiers.length) {
        return res.status(404).json({
          success: false,
          message: "Fichier non trouvé."
        });
      }
      
      // Récupérer le fichier à supprimer
      const fileToDelete = course.fichiers[index];
      
      // Supprimer le fichier du système de fichiers
      const filePath = path.join(__dirname, '..', fileToDelete.path || fileToDelete);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      // Supprimer le fichier de la base de données
      course.fichiers.splice(index, 1);
      
      // Mettre à jour la date de modification
      course.updatedAt = new Date();
      
      await course.save();
      
      res.status(200).json({
        success: true,
        message: "Fichier supprimé avec succès",
        course
      });
    } catch (err) {
      console.error("❌ Erreur suppression fichier :", err);
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors de la suppression du fichier."
      });
    }
  }
);

/**
 * @route GET /api/planning/file/:courseId/:fileIndex
 * @desc Télécharger un fichier d'une course
 * @access Private
 */
router.get(
  "/file/:courseId/:fileIndex",
  authenticateToken,
  authorizeRoles(['patron', 'chauffeur']),
  async (req, res) => {
    try {
      const { courseId, fileIndex } = req.params;
      
      // Vérifier que l'index est un nombre
      const index = parseInt(fileIndex);
      if (isNaN(index)) {
        return res.status(400).json({
          success: false,
          message: "Index de fichier invalide."
        });
      }
      
      // Récupérer la course
      const course = await Course.findById(courseId);
      
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course non trouvée."
        });
      }
      
      // Vérifier que l'utilisateur a accès à cette course
      if (course.entrepriseId && course.entrepriseId.toString() !== req.user.entrepriseId) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à accéder à cette course."
        });
      }
      
      // Vérifier que l'index est valide
      if (!course.fichiers || index < 0 || index >= course.fichiers.length) {
        return res.status(404).json({
          success: false,
          message: "Fichier non trouvé."
        });
      }
      
      // Récupérer le fichier
      const fileInfo = course.fichiers[index];
      const filePath = fileInfo.path || fileInfo;
      const fullPath = path.join(__dirname, '..', filePath);
      
      // Vérifier que le fichier existe
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({
          success: false,
          message: "Fichier physique non trouvé sur le serveur."
        });
      }
      
      // Déterminer le type MIME
      let contentType = 'application/octet-stream'; // Par défaut
      
      if (fileInfo.mimeType) {
        contentType = fileInfo.mimeType;
      } else {
        // Détecter par extension
        const ext = path.extname(fullPath).toLowerCase();
        if (ext === '.pdf') contentType = 'application/pdf';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.gif') contentType = 'image/gif';
        else if (ext === '.txt') contentType = 'text/plain';
        else if (ext === '.doc') contentType = 'application/msword';
        else if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      }
      
      // Déterminer le nom de fichier pour le téléchargement
      const fileName = fileInfo.originalName || path.basename(fullPath);
      
      // Définir les en-têtes
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      // Envoyer le fichier
      res.sendFile(fullPath);
    } catch (err) {
      console.error("❌ Erreur téléchargement fichier :", err);
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors du téléchargement du fichier."
      });
    }
  }
);

/**
 * @route GET /api/planning/:id
 * @desc Récupérer une course par ID
 * @access Private
 */
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles(['patron', 'chauffeur']),
  async (req, res) => {
    try {
      const courseId = req.params.id;
      
      // Options pour populate si nécessaire
      const populate = req.query.populate === 'true';
      
      let query = Course.findById(courseId);
      
      // Populate conditionnellement
      if (populate) {
        query = query.populate('chauffeur', 'name nom email')
                     .populate('client', 'nom prenom telephone');
      }
      
      const course = await query;
      
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course non trouvée."
        });
      }
      
      // Vérifier que l'utilisateur a accès à cette course
      if (course.entrepriseId && course.entrepriseId.toString() !== req.user.entrepriseId) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à accéder à cette course."
        });
      }
      
      res.status(200).json({
        success: true,
        data: course
      });
    } catch (err) {
      console.error("❌ Erreur récupération course :", err);
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors de la récupération de la course."
      });
    }
  }
);

/**
 * @route GET /api/planning/share/:id
 * @desc Récupérer une course par ID pour partage public
 * @access Public
 */
router.get(
  "/share/:id",
  async (req, res) => {
    try {
      const courseId = req.params.id;
      
      const course = await Course.findById(courseId)
                                .populate('chauffeur', 'name nom email')
                                .populate('client', 'nom prenom telephone');
      
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course non trouvée."
        });
      }
      
      // Ne renvoyer que les informations pertinentes pour le partage
      const sharedCourse = {
        _id: course._id,
        date: course.date,
        heure: course.heure,
        depart: course.depart,
        arrive: course.arrive,
        description: course.description,
        chauffeur: course.chauffeur ? {
          name: course.chauffeur.name || course.chauffeur.nom,
          email: course.chauffeur.email
        } : null,
        entrepriseId: course.entrepriseId,
        statut: course.statut
      };
      
      res.status(200).json({
        success: true,
        data: sharedCourse
      });
    } catch (err) {
      console.error("❌ Erreur récupération course partagée :", err);
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors de la récupération de la course."
      });
    }
  }
);

/**
 * @route POST /api/planning/termine/:id
 * @desc Marquer une course comme terminée
 * @access Private
 */
router.put(
  "/finish/:id",
  authenticateToken,
  authorizeRoles(['patron', 'chauffeur']),
  async (req, res) => {
    try {
      const courseId = req.params.id;
      
      // Récupérer la course
      const course = await Course.findById(courseId);
      
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course non trouvée."
        });
      }
      
      // Vérifier que l'utilisateur a accès à cette course
      if (course.entrepriseId && course.entrepriseId.toString() !== req.user.entrepriseId) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à modifier cette course."
        });
      }
      
      // Vérifier que la course n'est pas déjà terminée
      if (course.statut === "Terminée") {
        return res.status(400).json({
          success: false,
          message: "Cette course est déjà marquée comme terminée."
        });
      }
      
      // Mettre à jour le statut
      course.statut = "Terminée";
      course.termineeA = new Date();
      course.termineePar = req.user.id;
      course.updatedAt = new Date();
      
      await course.save();
      
      res.status(200).json({
        success: true,
        message: "Course marquée comme terminée avec succès.",
        data: course
      });
    } catch (err) {
      console.error("❌ Erreur pour marquer la course comme terminée :", err);
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors de la mise à jour du statut de la course."
      });
    }
  }
);

/**
 * @route PUT /api/planning/price/:id
 * @desc Mettre à jour le prix d'une course
 * @access Private
 */
router.put(
  "/price/:id",
  authenticateToken,
  authorizeRoles(['patron']),
  async (req, res) => {
    try {
      const { prix } = req.body;
      const courseId = req.params.id;
      
      // Valider le prix
      if (!prix || isNaN(parseFloat(prix))) {
        return res.status(400).json({
          success: false,
          message: "Prix invalide."
        });
      }
      
      // Récupérer la course
      const course = await Course.findById(courseId);
      
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course non trouvée."
        });
      }
      
      // Vérifier que l'utilisateur a accès à cette course
      if (course.entrepriseId && course.entrepriseId.toString() !== req.user.entrepriseId) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à modifier cette course."
        });
      }
      
      // Mettre à jour le prix
      course.prix = parseFloat(prix);
      course.updatedAt = new Date();
      
      await course.save();
      
      res.status(200).json({
        success: true,
        message: "Prix mis à jour avec succès.",
        data: course
      });
    } catch (err) {
      console.error("❌ Erreur mise à jour prix :", err);
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors de la mise à jour du prix."
      });
    }
  }
);

/**
 * @route POST /api/planning/test
 * @desc Route de test
 * @access Public
 */
router.get("/test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Route de test OK",
    version: "1.0",
    timestamp: new Date()
  });
});

module.exports = router;