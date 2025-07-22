const express = require("express");
const router = express.Router();
const Planning = require("../models/Planning");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const mongoose = require("mongoose");
const moment = require("moment");

// Stockage temporaire des liens de partage (en production, utilisez Redis ou une DB)
const shareLinks = new Map();

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

// Fonction pour générer les dates de récurrence
function generateRecurringDates(startDate, recurrence) {
  const dates = [];
  const start = moment(startDate);
  
  // Déterminer la date de fin selon le type
  let endDate;
  switch (recurrence.endType) {
    case 'date':
      endDate = moment(recurrence.endDate);
      break;
    case 'duration':
      const { value, unit } = recurrence.duration;
      endDate = moment(start).add(value, unit);
      break;
    case 'indefinite':
      // Limiter à 2 ans pour éviter de créer trop d'entrées
      endDate = moment(start).add(2, 'years');
      break;
    case 'occurrences':
      // On va calculer au fur et à mesure
      endDate = null;
      break;
    default:
      return dates;
  }
  
  let current = moment(start);
  let occurrenceCount = 0;
  const maxOccurrences = recurrence.endType === 'occurrences' ? recurrence.occurrences : 1000;
  
  while (occurrenceCount < maxOccurrences) {
    // Si on a une date de fin et qu'on l'a dépassée, on arrête
    if (endDate && current.isAfter(endDate)) break;
    
    // Ajouter la date selon la fréquence
    switch (recurrence.frequency) {
      case 'quotidien':
        dates.push(current.format('YYYY-MM-DD'));
        current.add(1, 'day');
        break;
        
      case 'hebdomadaire':
        // Pour hebdomadaire, on génère pour chaque jour de la semaine sélectionné
        if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
          const weekStart = moment(current).startOf('week');
          for (let dayOfWeek of recurrence.daysOfWeek) {
            const targetDate = moment(weekStart).day(dayOfWeek);
            if (targetDate.isSameOrAfter(start) && (!endDate || targetDate.isSameOrBefore(endDate))) {
              dates.push(targetDate.format('YYYY-MM-DD'));
              occurrenceCount++;
              if (recurrence.endType === 'occurrences' && occurrenceCount >= maxOccurrences) break;
            }
          }
        }
        current.add(1, 'week');
        break;
        
      case 'mensuel':
        // Pour mensuel, on prend le jour du mois spécifié
        const dayOfMonth = recurrence.dayOfMonth || start.date();
        const targetMonthDate = moment(current).date(Math.min(dayOfMonth, current.daysInMonth()));
        if (targetMonthDate.isSameOrAfter(start) && (!endDate || targetMonthDate.isSameOrBefore(endDate))) {
          dates.push(targetMonthDate.format('YYYY-MM-DD'));
          occurrenceCount++;
        }
        current.add(1, 'month');
        break;
    }
    
    // Sécurité pour éviter les boucles infinies
    if (dates.length > 1000) break;
  }
  
  // Retourner uniquement les dates uniques et triées
  return [...new Set(dates)].sort();
}

// 📦 Configuration de Multer pour les fichiers joints et PDF scannés
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadDir = "uploads/";
    
    // Créer un sous-dossier pour les PDF de fin de course
    if (file.fieldname === 'scanPdf') {
      uploadDir = "uploads/course-scans/";
    }
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    let uniqueName;
    
    if (file.fieldname === 'scanPdf') {
      // Nom spécifique pour les scans de fin de course
      uniqueName = `scan-${req.params.id}-${Date.now()}${ext}`;
    } else {
      uniqueName = `piece-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    }
    
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    let allowedTypes;
    
    if (file.fieldname === 'scanPdf') {
      // Pour les scans de fin de course, accepter PDF et images
      allowedTypes = /jpeg|jpg|png|pdf/;
    } else {
      // Pour les pièces jointes normales
      allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    }
    
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

// ✅ AJOUTER UNE COURSE (AVEC SUPPORT RÉCURRENCE)
router.post("/", async (req, res) => {
  try {
    console.log("📝 POST /planning - Création d'une nouvelle course");
    
    const { nom, prenom, depart, arrive, heure, date, description, color, entrepriseId, telephone, recurrence } = req.body;

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

    // Si c'est une course récurrente
    if (recurrence && recurrence.enabled) {
      console.log("🔄 Création de courses récurrentes");
      
      // Générer un ID de groupe pour lier toutes les courses récurrentes
      const recurrenceGroupId = new mongoose.Types.ObjectId();
      
      // Générer toutes les dates de récurrence
      const recurringDates = generateRecurringDates(date, recurrence);
      console.log(`📅 ${recurringDates.length} dates générées pour la récurrence`);
      
      // Créer toutes les courses récurrentes
      const coursesToCreate = recurringDates.map(courseDate => ({
        nom: nom.trim(),
        prenom: prenom.trim(),
        depart: depart.trim(),
        arrive: arrive.trim(),
        date: courseDate,
        heure,
        entrepriseId,
        description: description ? description.trim() : "",
        telephone: telephone ? telephone.trim() : "",
        color: color || "#5E35B1",
        statut: "En attente",
        chauffeur: "",
        pieceJointe: [],
        scanPdfUrl: null, // 🆕 Ajout du champ pour le PDF scanné
        recurrenceGroupId: recurrenceGroupId,
        recurrenceConfig: recurrence,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      
      // Insérer toutes les courses en une seule opération
      const insertedCourses = await Planning.insertMany(coursesToCreate);
      
      console.log(`✅ ${insertedCourses.length} courses récurrentes créées avec succès`);
      
      res.status(201).json({ 
        message: `✅ ${insertedCourses.length} courses récurrentes créées avec succès`,
        recurringCourses: insertedCourses.length,
        recurrenceGroupId: recurrenceGroupId
      });
      
    } else {
      // Course unique (comportement normal)
      const newCourse = new Planning({
        nom: nom.trim(),
        prenom: prenom.trim(),
        depart: depart.trim(),
        arrive: arrive.trim(),
        date,
        heure,
        entrepriseId,
        description: description ? description.trim() : "",
        telephone: telephone ? telephone.trim() : "",
        color: color || "#5E35B1",
        statut: "En attente",
        chauffeur: "",
        pieceJointe: [],
        scanPdfUrl: null, // 🆕 Ajout du champ pour le PDF scanné
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
    }

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
      telephone: course.telephone || '',
      scanPdfUrl: course.scanPdfUrl || null, // 🆕 Inclure l'URL du PDF scanné
    }));

    console.log(`✅ ${coursesFormatted.length} courses récupérées`);
    res.status(200).json(coursesFormatted);

  } catch (err) {
    console.error("❌ Erreur récupération planning :", err);
    res.status(500).json({ error: "Erreur lors de la récupération des courses" });
  }
});

// 🆕 NOUVELLE ROUTE : TERMINER UNE COURSE AVEC SCAN PDF
router.put("/finish-with-scan/:id", upload.single('scanPdf'), async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      // Nettoyer le fichier uploadé si l'ID est invalide
      if (req.file) {
        const fullPath = path.join(__dirname, "..", req.file.path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
      return res.status(400).json({ error: "ID de course invalide" });
    }

    console.log("📄 PUT /planning/finish-with-scan - Fin course avec scan:", req.params.id);

    // Vérifier que la course existe
    const currentCourse = await Planning.findById(req.params.id);
    if (!currentCourse) {
      // Nettoyer le fichier uploadé si la course n'existe pas
      if (req.file) {
        const fullPath = path.join(__dirname, "..", req.file.path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }

    const updateData = { 
      statut: "Terminée",
      dateFin: new Date(),
      updatedAt: new Date()
    };

    // Si ce n'était pas encore en cours, marquer aussi le début
    if (!currentCourse.dateDebut) {
      updateData.dateDebut = new Date();
    }

    // Si un fichier PDF a été uploadé
    if (req.file) {
      updateData.scanPdfUrl = `/uploads/course-scans/${req.file.filename}`;
      console.log("📎 PDF scanné ajouté:", updateData.scanPdfUrl);
    }

    // Ajouter le prix si fourni
    if (req.body.prix !== undefined) {
      updateData.prix = parseFloat(req.body.prix) || 0;
    }

    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    console.log(`✅ Course terminée par ${updatedCourse.chauffeur} avec scan PDF`);
    
    res.status(200).json({ 
      message: "✅ Course terminée avec scan", 
      course: updatedCourse,
      scanPdfUrl: updatedCourse.scanPdfUrl
    });

  } catch (err) {
    console.error("❌ Erreur fin de course avec scan :", err);
    
    // Nettoyer le fichier en cas d'erreur
    if (req.file) {
      const fullPath = path.join(__dirname, "..", req.file.path);
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
    
    res.status(500).json({ error: "Erreur lors de la finalisation de la course" });
  }
});

// ✅ TERMINER UNE COURSE (sans scan)
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

    // Ajouter le prix si fourni
    if (req.body.prix !== undefined) {
      updateData.prix = parseFloat(req.body.prix) || 0;
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

// 🆕 NOUVELLE ROUTE : AJOUTER UN SCAN PDF À UNE COURSE DÉJÀ TERMINÉE
router.post("/add-scan/:id", upload.single('scanPdf'), async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      if (req.file) {
        const fullPath = path.join(__dirname, "..", req.file.path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
      return res.status(400).json({ error: "ID de course invalide" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "❌ Aucun fichier PDF envoyé." });
    }

    console.log("📎 POST /planning/add-scan - Ajout scan PDF pour:", req.params.id);

    const course = await Planning.findById(req.params.id);
    if (!course) {
      const fullPath = path.join(__dirname, "..", req.file.path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }

    // Supprimer l'ancien scan s'il existe
    if (course.scanPdfUrl) {
      const oldPath = path.join(__dirname, "..", course.scanPdfUrl);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
          console.log("🗑️ Ancien scan supprimé");
        } catch (error) {
          console.error("Erreur suppression ancien scan:", error);
        }
      }
    }

    // Mettre à jour avec le nouveau scan
    course.scanPdfUrl = `/uploads/course-scans/${req.file.filename}`;
    course.updatedAt = new Date();
    await course.save();
    
    console.log("✅ Scan PDF ajouté avec succès");
    res.status(200).json({ 
      message: "📄 Scan PDF ajouté avec succès", 
      course,
      scanPdfUrl: course.scanPdfUrl
    });

  } catch (err) {
    console.error("❌ Erreur ajout scan PDF :", err);
    
    if (req.file) {
      const fullPath = path.join(__dirname, "..", req.file.path);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (cleanupErr) {
          console.error("❌ Erreur nettoyage fichier :", cleanupErr);
        }
      }
    }
    
    res.status(500).json({ error: "Erreur lors de l'ajout du scan PDF" });
  }
});

// ✅ NOUVELLE ROUTE : ARRÊTER UNE RÉCURRENCE
router.put("/stop-recurrence/:groupId", async (req, res) => {
  try {
    const { groupId } = req.params;
    
    if (!groupId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de groupe invalide" });
    }

    console.log("⏹️ PUT /planning/stop-recurrence - Arrêt récurrence:", groupId);

    // Supprimer toutes les courses futures de ce groupe
    const today = moment().format('YYYY-MM-DD');
    
    const result = await Planning.deleteMany({
      recurrenceGroupId: groupId,
      date: { $gt: today },
      statut: { $in: ['En attente', 'Assignée'] }
    });

    console.log(`✅ ${result.deletedCount} courses futures supprimées`);
    
    res.status(200).json({ 
      message: `✅ Récurrence arrêtée. ${result.deletedCount} courses futures supprimées.`,
      deletedCount: result.deletedCount
    });

  } catch (err) {
    console.error("❌ Erreur arrêt récurrence :", err);
    res.status(500).json({ error: "Erreur lors de l'arrêt de la récurrence" });
  }
});

// ✅ NOUVELLE ROUTE : SUPPRIMER UN GROUPE DE RÉCURRENCE COMPLET
router.delete("/recurring-group/:groupId", async (req, res) => {
  try {
    const { groupId } = req.params;
    
    if (!groupId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de groupe invalide" });
    }

    console.log("🗑️ DELETE /planning/recurring-group - Suppression groupe:", groupId);

    const result = await Planning.deleteMany({
      recurrenceGroupId: groupId
    });

    console.log(`✅ ${result.deletedCount} courses du groupe supprimées`);
    
    res.status(200).json({ 
      message: `✅ Série de courses supprimée. ${result.deletedCount} courses supprimées.`,
      deletedCount: result.deletedCount
    });

  } catch (err) {
    console.error("❌ Erreur suppression groupe :", err);
    res.status(500).json({ error: "Erreur lors de la suppression du groupe" });
  }
});

// ✅ RÉCUPÉRER LE PLANNING D'UN CHAUFFEUR
// Dans planningRoutes.js - Remplacer la route GET /planning/chauffeur/:chauffeurNom

router.get("/chauffeur/:chauffeurNom", async (req, res) => {
  try {
    const { entrepriseId, date, dateStart, dateEnd } = req.query; // Ajouter 'date' ici
    const chauffeurNom = decodeURIComponent(req.params.chauffeurNom);
    
    if (!entrepriseId) {
      return res.status(400).json({ error: "❌ entrepriseId requis" });
    }

    if (!chauffeurNom || !chauffeurNom.trim()) {
      return res.status(400).json({ error: "❌ Nom du chauffeur requis" });
    }

    console.log("👤 GET /planning/chauffeur - Récupération pour:", chauffeurNom);
    console.log("🏢 EntrepriseId:", entrepriseId);
    console.log("📅 Date:", date || dateStart || dateEnd || "Pas de date spécifiée");

    // Construction du filtre avec échappement des caractères spéciaux
    const filter = {
      entrepriseId,
      chauffeur: { $regex: new RegExp(`^${escapeRegExp(chauffeurNom.trim())}$`, "i") },
    };

    // NOUVEAU: Gérer le paramètre 'date' simple
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      filter.date = date;
      console.log("🔍 Filtre par date unique:", date);
    } 
    // Ou gérer les périodes avec dateStart/dateEnd
    else if (dateStart && dateEnd) {
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

    console.log("🔍 Filtre de recherche complet:", JSON.stringify(filter));

    const courses = await Planning.find(filter)
      .sort({ date: 1, heure: 1 })
      .lean();

    // Formater les courses avec tous les champs nécessaires
    const coursesFormatted = courses.map(course => ({
      ...course,
      name: `${course.prenom || ''} ${course.nom || ''}`.trim() || 'Client sans nom',
      pieceJointe: Array.isArray(course.pieceJointe) ? course.pieceJointe : [],
      description: course.description || '',
      telephone: course.telephone || '',
      depart: course.depart || 'Adresse de départ non spécifiée',
      arrive: course.arrive || 'Adresse d\'arrivée non spécifiée',
      scanPdfUrl: course.scanPdfUrl || null,
    }));

    console.log(`✅ ${coursesFormatted.length} courses trouvées pour ${chauffeurNom}`);
    
    // Debug: afficher les dates des courses trouvées
    if (coursesFormatted.length > 0) {
      console.log("📋 Dates des courses trouvées:", coursesFormatted.map(c => c.date));
    }
    
    res.status(200).json(coursesFormatted);

  } catch (err) {
    console.error("❌ Erreur récupération planning chauffeur :", err);
    
    if (err.message.includes('Invalid regular expression')) {
      return res.status(400).json({ error: "Nom de chauffeur contient des caractères invalides" });
    }
    
    res.status(500).json({ error: "Erreur lors de la récupération du planning" });
  }
});

// Ajouter temporairement dans planningRoutes.js

router.get("/debug-names/:entrepriseId", async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    const { date } = req.query;
    
    // Récupérer toutes les courses
    const allCourses = await Planning.find({
      entrepriseId: entrepriseId,
      date: date || moment().format('YYYY-MM-DD')
    }).select('chauffeur nom prenom statut heure date');
    
    // Récupérer tous les utilisateurs de l'entreprise
    const User = require("../models/User");
    const allUsers = await User.find({
      entrepriseId: entrepriseId
    }).select('name nom prenom email role');
    
    // Extraire les noms de chauffeurs uniques des courses
    const chauffeursDansCourses = [...new Set(allCourses.map(c => c.chauffeur).filter(c => c))];
    
    res.json({
      date: date || moment().format('YYYY-MM-DD'),
      chauffeursDansCourses: chauffeursDansCourses,
      utilisateurs: allUsers.map(u => ({
        id: u._id,
        name: u.name,
        nom: u.nom,
        prenom: u.prenom,
        nomComplet: `${u.prenom || ''} ${u.nom || u.name || ''}`.trim(),
        role: u.role
      })),
      courses: allCourses.map(c => ({
        id: c._id,
        client: `${c.prenom} ${c.nom}`,
        chauffeur: c.chauffeur,
        chauffeurLength: c.chauffeur ? c.chauffeur.length : 0,
        statut: c.statut,
        heure: c.heure
      }))
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ NOUVELLE ROUTE : PARTAGER UNE COURSE
router.post("/share/:id", async (req, res) => {
  try {
    const { senderEntrepriseId, courseData } = req.body;
    
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    console.log("🔗 POST /planning/share - Création lien de partage:", req.params.id);

    // Vérifier que la course existe
    const course = await Planning.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ error: "Course non trouvée" });
    }

    // Vérifier que l'entreprise est bien propriétaire
    if (course.entrepriseId.toString() !== senderEntrepriseId) {
      return res.status(403).json({ error: "Non autorisé à partager cette course" });
    }

    // Générer un token unique
    const shareToken = crypto.randomBytes(32).toString('hex');
    
    // Stocker les informations du partage (en production, utilisez Redis ou MongoDB)
    const shareData = {
      courseId: req.params.id,
      courseData: courseData || {
        nom: course.nom,
        prenom: course.prenom,
        depart: course.depart,
        arrive: course.arrive,
        date: course.date,
        heure: course.heure,
        description: course.description,
        telephone: course.telephone || '',
      },
      senderEntrepriseId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expire dans 24h
    };

    shareLinks.set(shareToken, shareData);

    // Nettoyer les liens expirés
    for (const [token, data] of shareLinks.entries()) {
      if (new Date(data.expiresAt) < new Date()) {
        shareLinks.delete(token);
      }
    }

    console.log("✅ Lien de partage créé avec succès");
    res.status(200).json({ 
      shareToken,
      expiresAt: shareData.expiresAt,
      message: "Lien de partage créé avec succès"
    });

  } catch (err) {
    console.error("❌ Erreur création lien de partage :", err);
    res.status(500).json({ error: "Erreur lors de la création du lien de partage" });
  }
});

// ✅ NOUVELLE ROUTE : ACCEPTER UNE COURSE PARTAGÉE
router.post("/accept-shared", async (req, res) => {
  try {
    const { shareToken, accepterEntrepriseId, accepterUserId } = req.body;

    if (!shareToken) {
      return res.status(400).json({ error: "Token de partage requis" });
    }

    console.log("🤝 POST /planning/accept-shared - Acceptation course partagée");

    // Récupérer les données du partage
    const shareData = shareLinks.get(shareToken);
    
    if (!shareData) {
      return res.status(404).json({ error: "Lien de partage invalide ou expiré" });
    }

    // Vérifier l'expiration
    if (new Date(shareData.expiresAt) < new Date()) {
      shareLinks.delete(shareToken);
      return res.status(404).json({ error: "Lien de partage expiré" });
    }

    // Vérifier si la course n'a pas déjà été acceptée
    const existingCourse = await Planning.findOne({
      nom: shareData.courseData.nom,
      prenom: shareData.courseData.prenom,
      date: shareData.courseData.date,
      heure: shareData.courseData.heure,
      entrepriseId: accepterEntrepriseId
    });

    if (existingCourse) {
      return res.status(409).json({ error: "Cette course existe déjà dans votre planning" });
    }

    // Créer la nouvelle course pour l'entreprise acceptante
    const newCourse = new Planning({
      ...shareData.courseData,
      entrepriseId: accepterEntrepriseId,
      statut: "En attente",
      chauffeur: "",
      color: "#6C63FF", // Couleur par défaut
      scanPdfUrl: null, // 🆕 Pas de scan PDF au départ
      createdAt: new Date(),
      updatedAt: new Date(),
      // Ajouter une référence à la course originale si nécessaire
      sharedFrom: shareData.senderEntrepriseId,
      originalCourseId: shareData.courseId
    });

    const savedCourse = await newCourse.save();

    // Supprimer le lien de partage après utilisation
    shareLinks.delete(shareToken);

    console.log("✅ Course partagée acceptée et ajoutée au planning");
    res.status(201).json({
      message: "Course ajoutée à votre planning avec succès",
      course: savedCourse
    });

  } catch (err) {
    console.error("❌ Erreur acceptation course partagée :", err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: "Erreurs de validation", details: errors });
    }
    
    res.status(500).json({ error: "Erreur lors de l'acceptation de la course" });
  }
});

// ✅ NOUVELLE ROUTE : OBTENIR LES DÉTAILS D'UN LIEN DE PARTAGE
router.get("/share-info/:token", async (req, res) => {
  try {
    const { token } = req.params;

    console.log("📋 GET /planning/share-info - Infos sur lien de partage");

    const shareData = shareLinks.get(token);
    
    if (!shareData) {
      return res.status(404).json({ error: "Lien de partage invalide ou expiré" });
    }

    // Vérifier l'expiration
    if (new Date(shareData.expiresAt) < new Date()) {
      shareLinks.delete(token);
      return res.status(404).json({ error: "Lien de partage expiré" });
    }

    // Ne pas exposer toutes les données, juste ce qui est nécessaire
    res.status(200).json({
      courseData: shareData.courseData,
      expiresAt: shareData.expiresAt,
      senderEntrepriseId: shareData.senderEntrepriseId
    });

  } catch (err) {
    console.error("❌ Erreur récupération infos partage :", err);
    res.status(500).json({ error: "Erreur lors de la récupération des informations" });
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

// ✅ METTRE À JOUR UNE COURSE
router.put("/:id", async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    console.log("📝 PUT /planning/:id - Mise à jour course:", req.params.id);

    const allowedUpdates = [
      'nom', 'prenom', 'depart', 'arrive', 'date', 'heure', 
      'statut', 'chauffeur', 'color', 'description', 'telephone'
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
    
    // 🆕 Supprimer le scan PDF s'il existe
    if (deleted.scanPdfUrl) {
      const pdfPath = path.join(__dirname, "..", deleted.scanPdfUrl);
      if (fs.existsSync(pdfPath)) {
        try {
          fs.unlinkSync(pdfPath);
          console.log("📄 Scan PDF supprimé");
        } catch (fileErr) {
          console.error("❌ Erreur suppression scan PDF :", fileErr);
        }
      }
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
      telephone: course.telephone || '',
      prix: course.prix || 0,
      scanPdfUrl: course.scanPdfUrl || null, // 🆕 Inclure l'URL du PDF scanné
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
      description: course.description || '',
      telephone: course.telephone || '',
      scanPdfUrl: course.scanPdfUrl || null, // 🆕 Inclure l'URL du PDF scanné
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

// 🆕 NOUVELLE ROUTE : TERMINER UNE COURSE AVEC DONNÉES COMPLÈTES
router.put("/finish-complete/:id", upload.fields([
  { name: 'scanPdf', maxCount: 1 },
  { name: 'attachments', maxCount: 10 }
]), async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      // Nettoyer les fichiers uploadés si l'ID est invalide
      if (req.files) {
        Object.values(req.files).flat().forEach(file => {
          const fullPath = path.join(__dirname, "..", file.path);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        });
      }
      return res.status(400).json({ error: "ID de course invalide" });
    }

    console.log("📄 PUT /planning/finish-complete - Fin course complète:", req.params.id);

    // Vérifier que la course existe
    const currentCourse = await Planning.findById(req.params.id);
    if (!currentCourse) {
      // Nettoyer les fichiers uploadés si la course n'existe pas
      if (req.files) {
        Object.values(req.files).flat().forEach(file => {
          const fullPath = path.join(__dirname, "..", file.path);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        });
      }
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }

    const updateData = { 
      statut: "Terminée",
      dateFin: new Date(),
      updatedAt: new Date()
    };

    // Si ce n'était pas encore en cours, marquer aussi le début
    if (!currentCourse.dateDebut) {
      updateData.dateDebut = new Date();
    }

    // Ajouter le prix si fourni
    if (req.body.prix !== undefined) {
      const prix = parseFloat(req.body.prix);
      if (!isNaN(prix) && prix >= 0) {
        updateData.prix = prix;
      }
    }

    // Ajouter les notes si fournies
    if (req.body.notes && req.body.notes.trim()) {
      updateData.notes = req.body.notes.trim();
    }

    // Ajouter le temps d'attente si fourni
    if (req.body.tempsAttente && req.body.tempsAttente.trim()) {
      updateData.tempsAttente = req.body.tempsAttente.trim();
    }

    // Traiter le scan PDF si fourni
    if (req.files && req.files.scanPdf && req.files.scanPdf[0]) {
      updateData.scanPdfUrl = `/uploads/course-scans/${req.files.scanPdf[0].filename}`;
      console.log("📎 PDF scanné ajouté:", updateData.scanPdfUrl);
    }

    // Traiter les pièces jointes si fournies
    if (req.files && req.files.attachments) {
      const attachmentPaths = req.files.attachments.map(file => `/uploads/${file.filename}`);
      
      // Ajouter aux pièces jointes existantes
      const existingAttachments = Array.isArray(currentCourse.pieceJointe) 
        ? currentCourse.pieceJointe 
        : [];
      
      updateData.pieceJointe = [...existingAttachments, ...attachmentPaths];
      console.log("📎 Pièces jointes ajoutées:", attachmentPaths.length);
    }

    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    console.log(`✅ Course terminée complètement par ${updatedCourse.chauffeur}`);
    
    res.status(200).json({ 
      message: "✅ Course terminée avec succès", 
      course: updatedCourse,
      scanPdfUrl: updatedCourse.scanPdfUrl,
      attachments: updatedCourse.pieceJointe
    });

  } catch (err) {
    console.error("❌ Erreur fin de course complète :", err);
    
    // Nettoyer les fichiers en cas d'erreur
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        const fullPath = path.join(__dirname, "..", file.path);
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch (cleanupErr) {
            console.error("❌ Erreur nettoyage fichier :", cleanupErr);
          }
        }
      });
    }
    
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "ID de course invalide" });
    }
    
    res.status(500).json({ error: "Erreur lors de la finalisation de la course" });
  }
});

// 🆕 NOUVELLE ROUTE : AJOUTER DES NOTES À UNE COURSE
router.put("/notes/:id", async (req, res) => {
  try {
    const { notes, tempsAttente } = req.body;
    
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "ID de course invalide" });
    }

    console.log("📝 PUT /planning/notes - Ajout notes:", req.params.id);

    const updateData = { 
      updatedAt: new Date()
    };

    if (notes !== undefined) {
      updateData.notes = notes.trim();
    }

    if (tempsAttente !== undefined) {
      updateData.tempsAttente = tempsAttente.trim();
    }

    const updatedCourse = await Planning.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedCourse) {
      return res.status(404).json({ message: "❌ Course non trouvée." });
    }
    
    console.log("✅ Notes ajoutées avec succès");
    res.status(200).json({ 
      message: "📝 Notes ajoutées avec succès", 
      course: updatedCourse 
    });

  } catch (err) {
    console.error("❌ Erreur ajout notes :", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({ error: "ID de course invalide" });
    }
    
    res.status(500).json({ error: "Erreur lors de l'ajout des notes" });
  }
});

// 🆕 NOUVELLE ROUTE : RÉCUPÉRER LES STATISTIQUES D'UN CHAUFFEUR
router.get("/stats/chauffeur/:chauffeurNom", async (req, res) => {
  try {
    const { entrepriseId, dateStart, dateEnd } = req.query;
    const chauffeurNom = decodeURIComponent(req.params.chauffeurNom);
    
    if (!entrepriseId) {
      return res.status(400).json({ error: "❌ entrepriseId requis" });
    }

    if (!chauffeurNom || !chauffeurNom.trim()) {
      return res.status(400).json({ error: "❌ Nom du chauffeur requis" });
    }

    console.log("📊 GET /planning/stats/chauffeur - Statistiques pour:", chauffeurNom);

    // Construction du filtre
    const filter = {
      entrepriseId,
      chauffeur: { $regex: new RegExp(`^${escapeRegExp(chauffeurNom.trim())}$`, "i") },
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

    // Récupérer toutes les courses du chauffeur
    const courses = await Planning.find(filter).lean();

    // Calculer les statistiques
    const stats = {
      totalCourses: courses.length,
      coursesTerminees: courses.filter(c => c.statut === 'Terminée').length,
      coursesEnCours: courses.filter(c => c.statut === 'En cours').length,
      coursesAssignees: courses.filter(c => c.statut === 'Assignée').length,
      totalChiffre: courses
        .filter(c => c.statut === 'Terminée' && c.prix)
        .reduce((sum, c) => sum + (parseFloat(c.prix) || 0), 0),
      moyennePrix: 0,
      tempsTotal: 0,
      moyenneTemps: 0
    };

    // Calculer la moyenne des prix
    const coursesAvecPrix = courses.filter(c => c.statut === 'Terminée' && c.prix > 0);
    if (coursesAvecPrix.length > 0) {
      stats.moyennePrix = stats.totalChiffre / coursesAvecPrix.length;
    }

    // Calculer les temps de course
    const coursesAvecTemps = courses.filter(c => c.dateDebut && c.dateFin);
    if (coursesAvecTemps.length > 0) {
      const tempsTotal = coursesAvecTemps.reduce((sum, c) => {
        const debut = new Date(c.dateDebut);
        const fin = new Date(c.dateFin);
        return sum + (fin.getTime() - debut.getTime());
      }, 0);
      
      stats.tempsTotal = Math.round(tempsTotal / 60000); // en minutes
      stats.moyenneTemps = Math.round(stats.tempsTotal / coursesAvecTemps.length);
    }

    // Statistiques par jour de la semaine
    const statsParJour = {};
    ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].forEach(jour => {
      statsParJour[jour] = { courses: 0, chiffre: 0 };
    });

    courses.forEach(course => {
      const jourSemaine = moment(course.date).format('dddd');
      const jourFr = {
        'Monday': 'Lundi',
        'Tuesday': 'Mardi', 
        'Wednesday': 'Mercredi',
        'Thursday': 'Jeudi',
        'Friday': 'Vendredi',
        'Saturday': 'Samedi',
        'Sunday': 'Dimanche'
      }[jourSemaine] || jourSemaine;

      if (statsParJour[jourFr]) {
        statsParJour[jourFr].courses++;
        if (course.statut === 'Terminée' && course.prix) {
          statsParJour[jourFr].chiffre += parseFloat(course.prix) || 0;
        }
      }
    });

    stats.statsParJour = statsParJour;

    console.log(`✅ Statistiques calculées pour ${chauffeurNom}`);
    res.status(200).json(stats);

  } catch (err) {
    console.error("❌ Erreur récupération statistiques chauffeur :", err);
    res.status(500).json({ error: "Erreur lors de la récupération des statistiques" });
  }
});

// 🆕 NOUVELLE ROUTE : EXPORTER LES DONNÉES D'UN CHAUFFEUR
router.get("/export/chauffeur/:chauffeurNom", async (req, res) => {
  try {
    const { entrepriseId, dateStart, dateEnd, format = 'json' } = req.query;
    const chauffeurNom = decodeURIComponent(req.params.chauffeurNom);
    
    if (!entrepriseId) {
      return res.status(400).json({ error: "❌ entrepriseId requis" });
    }

    console.log("📤 GET /planning/export/chauffeur - Export pour:", chauffeurNom);

    // Construction du filtre
    const filter = { entrepriseId };
    
    if (chauffeurNom && chauffeurNom.trim()) {
      filter.chauffeur = { $regex: new RegExp(`^${escapeRegExp(chauffeurNom.trim())}$`, "i") };
    }

    // Filtre par période
    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart && /^\d{4}-\d{2}-\d{2}$/.test(dateStart)) {
        filter.date.$gte = dateStart;
      }
      if (dateEnd && /^\d{4}-\d{2}-\d{2}$/.test(dateEnd)) {
        filter.date.$lte = dateEnd;
      }
    }

    const courses = await Planning.find(filter)
      .sort({ date: -1, heure: -1 })
      .lean();

    // Formater les données pour l'export
    const exportData = courses.map(course => ({
      id: course._id,
      date: course.date,
      heure: course.heure,
      client: `${course.prenom} ${course.nom}`,
      telephone: course.telephone || '',
      depart: course.depart,
      arrive: course.arrive,
      chauffeur: course.chauffeur || '',
      statut: course.statut,
      prix: course.prix || 0,
      notes: course.notes || '',
      tempsAttente: course.tempsAttente || '',
      dateDebut: course.dateDebut ? moment(course.dateDebut).format('YYYY-MM-DD HH:mm:ss') : '',
      dateFin: course.dateFin ? moment(course.dateFin).format('YYYY-MM-DD HH:mm:ss') : '',
      dureeMinutes: course.dateDebut && course.dateFin 
        ? Math.round((new Date(course.dateFin) - new Date(course.dateDebut)) / 60000)
        : 0,
      description: course.description || '',
      pieceJointe: Array.isArray(course.pieceJointe) ? course.pieceJointe.length : 0,
      scanPdf: course.scanPdfUrl ? 'Oui' : 'Non'
    }));

    if (format === 'csv') {
      // Générer CSV
      const csvHeaders = Object.keys(exportData[0] || {}).join(',');
      const csvRows = exportData.map(row => 
        Object.values(row).map(value => 
          typeof value === 'string' && value.includes(',') 
            ? `"${value.replace(/"/g, '""')}"` 
            : value
        ).join(',')
      );
      const csvContent = [csvHeaders, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=courses_${chauffeurNom}_${Date.now()}.csv`);
      res.send(csvContent);
    } else {
      // Format JSON par défaut
      res.status(200).json({
        chauffeur: chauffeurNom,
        periode: {
          debut: dateStart || 'Début',
          fin: dateEnd || 'Fin'
        },
        totalCourses: exportData.length,
        courses: exportData
      });
    }

    // Ajouter temporairement dans planningRoutes.js

router.get("/debug-chauffeur/:entrepriseId", async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    const { date } = req.query;
    
    // Récupérer toutes les courses de l'entreprise pour cette date
    const allCourses = await Planning.find({
      entrepriseId: entrepriseId,
      date: date || moment().format('YYYY-MM-DD')
    }).select('chauffeur nom prenom statut heure date');
    
    // Extraire tous les noms de chauffeurs uniques
    const chauffeurs = [...new Set(allCourses.map(c => c.chauffeur).filter(c => c))];
    
    res.json({
      date: date || moment().format('YYYY-MM-DD'),
      totalCourses: allCourses.length,
      chauffeurs: chauffeurs,
      courses: allCourses.map(c => ({
        id: c._id,
        client: `${c.prenom} ${c.nom}`,
        chauffeur: c.chauffeur,
        statut: c.statut,
        heure: c.heure
      }))
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

    console.log(`✅ Export généré: ${exportData.length} courses`);

  } catch (err) {
    console.error("❌ Erreur export chauffeur :", err);
    res.status(500).json({ error: "Erreur lors de l'export des données" });
  }
});

module.exports = router;