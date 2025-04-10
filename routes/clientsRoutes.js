const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const ExcelJS = require('exceljs');
const Client = require('../models/Client');

// ✅ Dossier d’upload
const UPLOADS_DIR = './uploads/clients';

// 📁 Création du dossier s’il n’existe pas
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 📦 Multer - Config de stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname),
});

const upload = multer({ storage });

// ✅ POST /add : Ajouter un client
router.post(
  '/add',
  upload.fields([
    { name: 'carteVitale', maxCount: 1 },
    { name: 'bonsTransport', maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const { nom, prenom, adresse, telephone, entrepriseId, caisseSociale } = req.body;

      const email = req.body.email || `${nom.replace(/\s+/g, '').toLowerCase()}-${Date.now()}@client.com`;
      const carteVitale = req.files['carteVitale'] ? req.files['carteVitale'][0].path : null;
      const bonsTransport = req.files['bonsTransport'] ? req.files['bonsTransport'].map(f => f.path) : [];

      const newClient = new Client({
        nom,
        prenom,
        adresse,
        telephone,
        entrepriseId,
        email,
        caisseSociale,
        carteVitale,
        bonsTransport,
      });

      await newClient.save();
      res.status(201).json(newClient);
    } catch (error) {
      console.error("Erreur ajout client :", error);
      res.status(500).json({ message: "Erreur ajout client : " + error.message });
    }
  }
);

// ✅ PUT /:id : Modifier un client
router.put(
  '/:id',
  upload.fields([
    { name: 'carteVitale', maxCount: 1 },
    { name: 'bonsTransport', maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const { nom, prenom, adresse, telephone, entrepriseId, caisseSociale } = req.body;

      const updateData = {
        nom,
        prenom,
        adresse,
        telephone,
        entrepriseId,
        caisseSociale,
      };

      if (req.files['carteVitale']) {
        updateData.carteVitale = req.files['carteVitale'][0].path;
      }

      if (req.files['bonsTransport']) {
        updateData.bonsTransport = req.files['bonsTransport'].map(f => f.path);
      }

      const updatedClient = await Client.findByIdAndUpdate(req.params.id, updateData, { new: true });

      if (!updatedClient) {
        return res.status(404).json({ message: 'Client non trouvé' });
      }

      res.status(200).json(updatedClient);
    } catch (error) {
      console.error("Erreur modification client :", error);
      res.status(500).json({ message: "Erreur modification client : " + error.message });
    }
  }
);

// ✅ GET /:entrepriseId : Récupérer tous les clients d'une entreprise
router.get('/:entrepriseId', async (req, res) => {
  try {
    const clients = await Client.find({ entrepriseId: req.params.entrepriseId });
    res.json(clients);
  } catch (error) {
    console.error("Erreur récupération clients :", error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ DELETE /:id : Supprimer un client
router.delete('/:id', async (req, res) => {
  try {
    await Client.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Client supprimé.' });
  } catch (error) {
    console.error("Erreur suppression client :", error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ GET /export/:entrepriseId : Exporter les clients en Excel
router.get('/export/:entrepriseId', async (req, res) => {
  try {
    const clients = await Client.find({ entrepriseId: req.params.entrepriseId });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Clients');

    worksheet.columns = [
      { header: 'Nom', key: 'nom', width: 20 },
      { header: 'Prénom', key: 'prenom', width: 20 },
      { header: 'Adresse', key: 'adresse', width: 30 },
      { header: 'Téléphone', key: 'telephone', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Caisse sociale', key: 'caisseSociale', width: 30 },
    ];

    clients.forEach(client => {
      worksheet.addRow({
        nom: client.nom,
        prenom: client.prenom,
        adresse: client.adresse,
        telephone: client.telephone,
        email: client.email,
        caisseSociale: client.caisseSociale || '',
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=clients.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Erreur export Excel :", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
