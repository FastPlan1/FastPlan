const express = require('express');
const router = express.Router();
const multer = require('multer');
const Client = require('../models/Client');
const fs = require('fs');

// Configuration Multer
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

// Ajout client avec upload
router.post('/add', upload.fields([
  { name: 'carteVitale', maxCount: 1 },
  { name: 'bonsTransport', maxCount: 5 }
]), async (req, res) => {
  try {
    const { nom, prenom, adresse, telephone, entrepriseId } = req.body;

    // Générer une adresse email unique si non fournie afin d'éviter le duplicata (index unique sur email)
    const email = req.body.email || `${nom.replace(/\s+/g, "").toLowerCase()}-${Date.now()}@client.com`;

    const carteVitaleFile = req.files['carteVitale'] ? req.files['carteVitale'][0].path : null;
    const bonsTransportFiles = req.files['bonsTransport'] ? req.files['bonsTransport'].map(f => f.path) : [];

    const newClient = new Client({
      nom,
      prenom,
      adresse,
      telephone,
      entrepriseId,
      email, // Ajout de l'email généré
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

// Route pour récupérer les clients par entrepriseId
router.get('/:entrepriseId', async (req, res) => {
  try {
    const clients = await Client.find({ entrepriseId: req.params.entrepriseId });
    res.json(clients);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// Route pour supprimer un client
router.delete('/:id', async (req, res) => {
  try {
    await Client.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Client supprimé." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
