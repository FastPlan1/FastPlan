const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');

const Client = require('../models/Client');
const { authenticateToken, authorizeRoles, checkCompanyAccess } = require('../middleware/auth');

// ✅ Constantes et configuration
const UPLOADS_DIR = path.join(__dirname, '../uploads/clients');

// 📁 Création du dossier s'il n'existe pas
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 📦 Validation des fichiers
const fileFilter = (req, file, cb) => {
  // Liste des types MIME autorisés
  const allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé'), false);
  }
};

// 📦 Multer - Config de stockage sécurisée
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Créer un sous-dossier par entreprise
    const entrepriseId = req.body.entrepriseId || req.params.entrepriseId;
    const entrepriseDir = path.join(UPLOADS_DIR, entrepriseId);
    
    if (!fs.existsSync(entrepriseDir)) {
      fs.mkdirSync(entrepriseDir, { recursive: true });
    }
    
    cb(null, entrepriseDir);
  },
  filename: (req, file, cb) => {
    // Sécuriser le nom de fichier
    const fileExt = path.extname(file.originalname);
    const safeFileName = `${Date.now()}-${uuidv4()}${fileExt}`;
    cb(null, safeFileName);
  },
});

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 6 // Max 6 fichiers au total (1 carte vitale + 5 bons)
  }
});

/**
 * @route POST /api/clients/add
 * @desc Ajouter un client
 * @access Private (patron uniquement)
 */
router.post(
  '/add',
  authenticateToken,
  authorizeRoles(['patron']),
  checkCompanyAccess,
  upload.fields([
    { name: 'carteVitale', maxCount: 1 },
    { name: 'bonsTransport', maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const { 
        nom, 
        prenom, 
        adresse, 
        telephone, 
        entrepriseId, 
        caisseSociale,
        email: providedEmail
      } = req.body;

      // Validation des champs obligatoires
      if (!nom || !prenom) {
        return res.status(400).json({
          success: false,
          message: "Nom et prénom sont obligatoires"
        });
      }
      
      // Vérifier que l'entrepriseId correspond à celui de l'utilisateur
      if (entrepriseId !== req.user.entrepriseId) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à ajouter un client pour une autre entreprise"
        });
      }

      // Vérification et normalisation du téléphone
      let formattedTelephone = telephone;
      if (telephone) {
        // Supprimer tous les caractères non numériques
        formattedTelephone = telephone.replace(/[^\d+]/g, '');
        
        // Validation basique du format
        if (!/^(\+\d{1,3}|0)\d{9,}$/.test(formattedTelephone)) {
          return res.status(400).json({
            success: false,
            message: "Format de numéro de téléphone invalide"
          });
        }
      }

      // Générer un email si non fourni
      const email = providedEmail || `${nom.replace(/\s+/g, '').toLowerCase()}-${Date.now()}@client.vtc.com`;
      
      // Vérifier si l'email est déjà utilisé
      if (providedEmail) {
        const existingClient = await Client.findOne({ email: providedEmail, entrepriseId });
        if (existingClient) {
          return res.status(409).json({
            success: false,
            message: "Un client avec cet email existe déjà"
          });
        }
      }
      
      // Préparation des chemins de fichiers pour stockage en base
      const carteVitale = req.files['carteVitale'] 
        ? `/uploads/clients/${entrepriseId}/${req.files['carteVitale'][0].filename}` 
        : null;
        
      const bonsTransport = req.files['bonsTransport'] 
        ? req.files['bonsTransport'].map(f => `/uploads/clients/${entrepriseId}/${f.filename}`) 
        : [];

      // Création du client
      const newClient = new Client({
        nom,
        prenom,
        adresse,
        telephone: formattedTelephone,
        entrepriseId,
        email,
        caisseSociale,
        carteVitale,
        bonsTransport,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await newClient.save();
      
      res.status(201).json({
        success: true,
        message: "Client ajouté avec succès",
        client: newClient
      });
    } catch (error) {
      console.error("❌ Erreur ajout client :", error);
      
      // Nettoyage des fichiers en cas d'erreur
      if (req.files) {
        Object.values(req.files).flat().forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      
      // Gestion des erreurs de validation mongoose
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: "Données invalides",
          errors: Object.values(error.errors).map(err => err.message)
        });
      }
      
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors de l'ajout du client"
      });
    }
  }
);

/**
 * @route PUT /api/clients/:id
 * @desc Modifier un client
 * @access Private (patron uniquement)
 */
router.put(
  '/:id',
  authenticateToken,
  authorizeRoles(['patron']),
  checkCompanyAccess,
  upload.fields([
    { name: 'carteVitale', maxCount: 1 },
    { name: 'bonsTransport', maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const clientId = req.params.id;
      
      // Vérifier que le client existe et appartient à l'entreprise de l'utilisateur
      const existingClient = await Client.findById(clientId);
      
      if (!existingClient) {
        return res.status(404).json({
          success: false,
          message: "Client non trouvé"
        });
      }
      
      if (existingClient.entrepriseId !== req.user.entrepriseId) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à modifier ce client"
        });
      }

      const { 
        nom, 
        prenom, 
        adresse, 
        telephone, 
        caisseSociale, 
        email 
      } = req.body;

      // Vérification et normalisation du téléphone
      let formattedTelephone = telephone;
      if (telephone) {
        // Supprimer tous les caractères non numériques
        formattedTelephone = telephone.replace(/[^\d+]/g, '');
        
        // Validation basique du format
        if (!/^(\+\d{1,3}|0)\d{9,}$/.test(formattedTelephone)) {
          return res.status(400).json({
            success: false,
            message: "Format de numéro de téléphone invalide"
          });
        }
      }
      
      // Préparer les données de mise à jour
      const updateData = {
        nom: nom || existingClient.nom,
        prenom: prenom || existingClient.prenom,
        adresse: adresse || existingClient.adresse,
        telephone: formattedTelephone || existingClient.telephone,
        caisseSociale: caisseSociale || existingClient.caisseSociale,
        email: email || existingClient.email,
        updatedAt: new Date()
      };

      // Gérer la carte vitale
      if (req.files['carteVitale']) {
        // Supprimer l'ancien fichier si existant
        if (existingClient.carteVitale && fs.existsSync(path.join(__dirname, '..', existingClient.carteVitale))) {
          fs.unlinkSync(path.join(__dirname, '..', existingClient.carteVitale));
        }
        
        updateData.carteVitale = `/uploads/clients/${existingClient.entrepriseId}/${req.files['carteVitale'][0].filename}`;
      }

      // Gérer les bons de transport
      if (req.files['bonsTransport'] && req.files['bonsTransport'].length > 0) {
        // Si demandé explicitement, remplacer les bons existants
        if (req.body.replaceBons === 'true') {
          // Supprimer les anciens fichiers
          existingClient.bonsTransport.forEach(bon => {
            if (fs.existsSync(path.join(__dirname, '..', bon))) {
              fs.unlinkSync(path.join(__dirname, '..', bon));
            }
          });
          
          // Remplacer par les nouveaux
          updateData.bonsTransport = req.files['bonsTransport'].map(
            f => `/uploads/clients/${existingClient.entrepriseId}/${f.filename}`
          );
        } else {
          // Sinon, ajouter aux bons existants
          updateData.bonsTransport = [
            ...existingClient.bonsTransport,
            ...req.files['bonsTransport'].map(
              f => `/uploads/clients/${existingClient.entrepriseId}/${f.filename}`
            )
          ];
        }
      }

      // Mettre à jour le client
      const updatedClient = await Client.findByIdAndUpdate(
        clientId, 
        updateData, 
        { new: true, runValidators: true }
      );

      res.status(200).json({
        success: true,
        message: "Client mis à jour avec succès",
        client: updatedClient
      });
    } catch (error) {
      console.error("❌ Erreur modification client :", error);
      
      // Nettoyage des fichiers en cas d'erreur
      if (req.files) {
        Object.values(req.files).flat().forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      
      // Gestion des erreurs de validation mongoose
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: "Données invalides",
          errors: Object.values(error.errors).map(err => err.message)
        });
      }
      
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors de la modification du client"
      });
    }
  }
);

/**
 * @route GET /api/clients/:entrepriseId
 * @desc Récupérer tous les clients d'une entreprise
 * @access Private (patron et chauffeur)
 */
router.get(
  '/:entrepriseId',
  authenticateToken,
  authorizeRoles(['patron', 'chauffeur']),
  checkCompanyAccess,
  async (req, res) => {
    try {
      const { entrepriseId } = req.params;
      const { search, sort, limit = 100, page = 1, fields } = req.query;
      
      // Vérifier que l'entrepriseId correspond à celui de l'utilisateur
      if (entrepriseId !== req.user.entrepriseId) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à accéder aux clients d'une autre entreprise"
        });
      }
      
      // Construire la requête de base
      let query = { entrepriseId };
      
      // Ajouter la recherche si fournie
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
          { nom: searchRegex },
          { prenom: searchRegex },
          { adresse: searchRegex },
          { telephone: searchRegex },
          { email: searchRegex },
          { caisseSociale: searchRegex }
        ];
      }
      
      // Calculer le nombre total pour la pagination
      const total = await Client.countDocuments(query);
      
      // Construire la requête avec pagination et tri
      let clientsQuery = Client.find(query);
      
      // Sélection des champs si spécifiés
      if (fields) {
        const fieldsArray = fields.split(',');
        clientsQuery = clientsQuery.select(fieldsArray.join(' '));
      }
      
      // Tri
      if (sort) {
        const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
        const sortDirection = sort.startsWith('-') ? -1 : 1;
        clientsQuery = clientsQuery.sort({ [sortField]: sortDirection });
      } else {
        // Tri par défaut
        clientsQuery = clientsQuery.sort({ nom: 1 });
      }
      
      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      clientsQuery = clientsQuery.skip(skip).limit(parseInt(limit));
      
      // Exécuter la requête
      const clients = await clientsQuery.exec();
      
      res.status(200).json({
        success: true,
        count: clients.length,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        data: clients
      });
    } catch (error) {
      console.error("❌ Erreur récupération clients :", error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors de la récupération des clients"
      });
    }
  }
);

/**
 * @route GET /api/clients/detail/:id
 * @desc Récupérer un client par son ID
 * @access Private (patron et chauffeur)
 */
router.get(
  '/detail/:id',
  authenticateToken,
  authorizeRoles(['patron', 'chauffeur']),
  async (req, res) => {
    try {
      const clientId = req.params.id;
      
      const client = await Client.findById(clientId);
      
      if (!client) {
        return res.status(404).json({
          success: false,
          message: "Client non trouvé"
        });
      }
      
      // Vérifier que le client appartient à l'entreprise de l'utilisateur
      if (client.entrepriseId !== req.user.entrepriseId) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à accéder à ce client"
        });
      }
      
      res.status(200).json({
        success: true,
        data: client
      });
    } catch (error) {
      console.error("❌ Erreur récupération client :", error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors de la récupération du client"
      });
    }
  }
);

/**
 * @route DELETE /api/clients/:id
 * @desc Supprimer un client
 * @access Private (patron uniquement)
 */
router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles(['patron']),
  async (req, res) => {
    try {
      const clientId = req.params.id;
      
      // Vérifier que le client existe et appartient à l'entreprise de l'utilisateur
      const client = await Client.findById(clientId);
      
      if (!client) {
        return res.status(404).json({
          success: false,
          message: "Client non trouvé"
        });
      }
      
      if (client.entrepriseId !== req.user.entrepriseId) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à supprimer ce client"
        });
      }
      
      // Supprimer les fichiers associés
      // 1. Carte vitale
      if (client.carteVitale && fs.existsSync(path.join(__dirname, '..', client.carteVitale))) {
        fs.unlinkSync(path.join(__dirname, '..', client.carteVitale));
      }
      
      // 2. Bons de transport
      if (client.bonsTransport && client.bonsTransport.length > 0) {
        client.bonsTransport.forEach(bon => {
          if (fs.existsSync(path.join(__dirname, '..', bon))) {
            fs.unlinkSync(path.join(__dirname, '..', bon));
          }
        });
      }
      
      // Supprimer le client
      await Client.findByIdAndDelete(clientId);
      
      res.status(200).json({
        success: true,
        message: "Client supprimé avec succès"
      });
    } catch (error) {
      console.error("❌ Erreur suppression client :", error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors de la suppression du client"
      });
    }
  }
);

/**
 * @route GET /api/clients/export/:entrepriseId
 * @desc Exporter les clients en Excel
 * @access Private (patron uniquement)
 */
router.get(
  '/export/:entrepriseId',
  authenticateToken,
  authorizeRoles(['patron']),
  checkCompanyAccess,
  async (req, res) => {
    try {
      const { entrepriseId } = req.params;
      
      // Vérifier que l'entrepriseId correspond à celui de l'utilisateur
      if (entrepriseId !== req.user.entrepriseId) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à exporter les clients d'une autre entreprise"
        });
      }
      
      // Récupérer les clients avec tri alphabétique
      const clients = await Client.find({ entrepriseId }).sort({ nom: 1, prenom: 1 });

      // Créer le workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'VTC Manager';
      workbook.lastModifiedBy = req.user.id;
      workbook.created = new Date();
      workbook.modified = new Date();
      
      // Ajouter une feuille
      const worksheet = workbook.addWorksheet('Clients');

      // Définir les colonnes
      worksheet.columns = [
        { header: 'Nom', key: 'nom', width: 20, style: { font: { bold: true } } },
        { header: 'Prénom', key: 'prenom', width: 20 },
        { header: 'Adresse', key: 'adresse', width: 40 },
        { header: 'Téléphone', key: 'telephone', width: 15 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Caisse sociale', key: 'caisseSociale', width: 30 },
        { header: 'Carte Vitale', key: 'carteVitale', width: 15 },
        { header: 'Nombre de bons', key: 'nbBons', width: 15 },
        { header: 'Créé le', key: 'createdAt', width: 20 },
        { header: 'Mis à jour le', key: 'updatedAt', width: 20 },
      ];

      // Styler l'en-tête
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0D47A1' }
      };
      
      // Ajouter les données
      clients.forEach(client => {
        worksheet.addRow({
          nom: client.nom,
          prenom: client.prenom,
          adresse: client.adresse,
          telephone: client.telephone,
          email: client.email,
          caisseSociale: client.caisseSociale || '',
          carteVitale: client.carteVitale ? 'Oui' : 'Non',
          nbBons: client.bonsTransport ? client.bonsTransport.length : 0,
          createdAt: client.createdAt ? client.createdAt.toLocaleDateString('fr-FR') : '',
          updatedAt: client.updatedAt ? client.updatedAt.toLocaleDateString('fr-FR') : '',
        });
      });

      // Ajouter un filtre automatique
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: 10 }
      };
      
      // Définir les en-têtes de réponse
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition', 
        `attachment; filename=clients_${entrepriseId}_${Date.now()}.xlsx`
      );

      // Écrire directement dans la réponse
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("❌ Erreur export Excel :", error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors de l'export Excel"
      });
    }
  }
);

/**
 * @route GET /api/clients/file/:type/:filename
 * @desc Télécharger un fichier (carte vitale ou bon de transport)
 * @access Private (patron et chauffeur)
 */
router.get(
  '/file/:type/:entrepriseId/:filename',
  authenticateToken,
  authorizeRoles(['patron', 'chauffeur']),
  checkCompanyAccess,
  async (req, res) => {
    try {
      const { type, entrepriseId, filename } = req.params;
      
      // Vérifier que l'entrepriseId correspond à celui de l'utilisateur
      if (entrepriseId !== req.user.entrepriseId) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à accéder aux fichiers d'une autre entreprise"
        });
      }
      
      // Vérifier que le type est valide
      if (type !== 'carteVitale' && type !== 'bonTransport') {
        return res.status(400).json({
          success: false,
          message: "Type de fichier invalide"
        });
      }
      
      // Construire le chemin du fichier
      const filePath = path.join(UPLOADS_DIR, entrepriseId, filename);
      
      // Vérifier que le fichier existe
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: "Fichier non trouvé"
        });
      }
      
      // Déterminer le type MIME
      let contentType = 'application/octet-stream';
      const ext = path.extname(filename).toLowerCase();
      
      if (ext === '.pdf') contentType = 'application/pdf';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.gif') contentType = 'image/gif';
      else if (ext === '.webp') contentType = 'image/webp';
      else if (ext === '.doc') contentType = 'application/msword';
      else if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      
      // Définir les en-têtes
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Envoyer le fichier
      res.sendFile(filePath);
    } catch (error) {
      console.error("❌ Erreur téléchargement fichier :", error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors du téléchargement du fichier"
      });
    }
  }
);

/**
 * @route DELETE /api/clients/file/:id/:type/:index
 * @desc Supprimer un fichier (carte vitale ou bon de transport)
 * @access Private (patron uniquement)
 */
router.delete(
  '/file/:id/:type/:index?',
  authenticateToken,
  authorizeRoles(['patron']),
  async (req, res) => {
    try {
      const { id, type, index } = req.params;
      
      // Vérifier que le client existe et appartient à l'entreprise de l'utilisateur
      const client = await Client.findById(id);
      
      if (!client) {
        return res.status(404).json({
          success: false,
          message: "Client non trouvé"
        });
      }
      
      if (client.entrepriseId !== req.user.entrepriseId) {
        return res.status(403).json({
          success: false,
          message: "Vous n'êtes pas autorisé à supprimer les fichiers de ce client"
        });
      }
      
      // Traiter selon le type
      if (type === 'carteVitale') {
        // Vérifier que la carte vitale existe
        if (!client.carteVitale) {
          return res.status(404).json({
            success: false,
            message: "Carte vitale non trouvée"
          });
        }
        
        // Supprimer le fichier
        const filePath = path.join(__dirname, '..', client.carteVitale);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        // Mettre à jour le client
        client.carteVitale = null;
        await client.save();
        
        return res.status(200).json({
          success: true,
          message: "Carte vitale supprimée avec succès"
        });
      } else if (type === 'bonTransport') {
        // Vérifier que l'index est fourni et valide
        if (!index) {
          return res.status(400).json({
            success: false,
            message: "Index du bon de transport requis"
          });
        }
        
        const bonIndex = parseInt(index);
        
        if (isNaN(bonIndex) || bonIndex < 0 || bonIndex >= client.bonsTransport.length) {
          return res.status(400).json({
            success: false,
            message: "Index du bon de transport invalide"
          });
        }
        
        // Récupérer le chemin du bon à supprimer
        const bonPath = client.bonsTransport[bonIndex];
        
        // Supprimer le fichier
        const filePath = path.join(__dirname, '..', bonPath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        // Mettre à jour le client
        client.bonsTransport.splice(bonIndex, 1);
        await client.save();
        
        return res.status(200).json({
          success: true,
          message: "Bon de transport supprimé avec succès"
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Type de fichier invalide"
        });
      }
    } catch (error) {
      console.error("❌ Erreur suppression fichier :", error);
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors de la suppression du fichier"
      });
    }
  }
);

module.exports = router;