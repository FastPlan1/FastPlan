const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true,
    trim: true,
  },
  prenom: {
    type: String,
    required: true,
    trim: true,
  },
  adresse: {
    type: String,
    required: true,
    trim: true,
  },
  telephone: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  caisseSociale: {
    type: String,
    default: '',
    trim: true,
  },
  carteVitale: {
    type: String,
    default: null, // Chemin du fichier
  },
  bonsTransport: {
    type: [String],
    default: [],
  },
  entrepriseId: {
    type: mongoose.Schema.Types.Mixed, // Accepte ObjectId ou string pour les IDs temporaires
    ref: 'Entreprise',
    required: true,
    validate: {
      validator: function(v) {
        // Valide si c'est un ObjectId ou une chaîne avec préfixe "temp-"
        return mongoose.Types.ObjectId.isValid(v) || 
               (typeof v === 'string' && v.startsWith('temp-'));
      },
      message: "L'entrepriseId doit être un ObjectId valide ou une chaîne temporaire"
    }
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Client', clientSchema);