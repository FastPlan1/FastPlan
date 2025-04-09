const express = require('express');
const router = express.Router();
const multer = require('multer');
const Client = require('../models/Client');
const fs = require('fs');
const ExcelJS = require('exceljs');

// Configuration de Multer pour le stockage des fichiers clients
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/clients/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '_' + file.originalname);
  },
});
const upload = multer({ storage });

// POST /add : Ajout d'un client (gestion des fichiers et caisse sociale)
router.post('/add', upload.fields([
  { name: 'carteVitale', maxCount: 1 },
  { name: 'bonsTransport', maxCount: 5 }
]), async (req, res) => {
  try {
    const { nom, prenom, adresse, telephone, entrepriseId, caisseSociale } = req.body;

    // Générer une adresse email unique si non fournie
    const email = req.body.email || `${nom.replace(/\s+/g, "").toLowerCase()}-${Date.now()}@client.com`;

    const carteVitaleFile = req.files['carteVitale'] ? req.files['carteVitale'][0].path : null;
    const bonsTransportFiles = req.files['bonsTransport'] ? req.files['bonsTransport'].map(f => f.path) : [];

    const newClient = new Client({
      nom,
      prenom,
      adresse,
      telephone,
      entrepriseId,
      email,
      caisseSociale, // Champ optionnel pour la caisse sociale (texte en une phrase)
      carteVitale: carteVitaleFile,
      bonsTransport: bonsTransportFiles,
    });

    await newClient.save();
    res.status(201).json(newClient);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// PUT /:id : Modification d'un client
router.put('/:id', upload.fields([
  { name: 'carteVitale', maxCount: 1 },
  { name: 'bonsTransport', maxCount: 5 }
]), async (req, res) => {
  try {
    const { nom, prenom, adresse, telephone, entrepriseId, caisseSociale } = req.body;
    const updateData = { nom, prenom, adresse, telephone, entrepriseId, caisseSociale };

    if (req.files['carteVitale']) {
      updateData.carteVitale = req.files['carteVitale'][0].path;
    }
    if (req.files['bonsTransport']) {
      updateData.bonsTransport = req.files['bonsTransport'].map(f => f.path);
    }

    const client = await Client.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!client) {
      return res.status(404).json({ message: "Client non trouvé." });
    }
    res.status(200).json(client);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// GET /:entrepriseId : Récupérer la liste des clients d'une entreprise
router.get('/:entrepriseId', async (req, res) => {
  try {
    const clients = await Client.find({ entrepriseId: req.params.entrepriseId });
    res.json(clients);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE /:id : Supprimer un client
router.delete('/:id', async (req, res) => {
  try {
    await Client.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Client supprimé." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// GET /export/:entrepriseId : Exporter la liste des clients en Excel
router.get('/export/:entrepriseId', async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    const clients = await Client.find({ entrepriseId });
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Clients');

    // Ajout de la ligne d'en-tête
    worksheet.addRow(['Nom', 'Prénom', 'Adresse', 'Téléphone', 'Email', 'Caisse sociale']);

    // Ajout des données pour chaque client
    clients.forEach(client => {
      worksheet.addRow([
        client.nom,
        client.prenom,
        client.adresse,
        client.telephone,
        client.email,
        client.caisseSociale || ''
      ]);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=clients.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
