const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.Mixed, // Accepte ObjectId ou string pour les IDs temporaires
      ref: "Conversation",
      required: true,
      validate: {
        validator: function(v) {
          // Valide si c'est un ObjectId ou une chaîne avec préfixe "temp-"
          return mongoose.Types.ObjectId.isValid(v) || 
                 (typeof v === 'string' && v.startsWith('temp-'));
        },
        message: "L'ID conversation doit être un ObjectId valide ou une chaîne temporaire"
      }
    },
    sender: {
      type: mongoose.Schema.Types.Mixed, // Accepte ObjectId ou string pour les IDs temporaires
      ref: "User",
      required: true,
      validate: {
        validator: function(v) {
          // Valide si c'est un ObjectId ou une chaîne avec préfixe "temp-" ou non défini
          return v !== 'undefined' && 
                (mongoose.Types.ObjectId.isValid(v) || 
                (typeof v === 'string' && v.startsWith('temp-')));
        },
        message: "L'ID sender doit être un ObjectId valide ou une chaîne temporaire"
      }
    },
    text: {
      type: String,
      default: "", // texte peut être vide si c'est un fichier uniquement
    },
    file: {
      type: String, // chemin du fichier uploadé (ex: /uploads/chat/filename.pdf)
      default: null,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.Mixed, // Accepte ObjectId ou string pour les IDs temporaires
        ref: "User",
        validate: {
          validator: function(v) {
            // Valide si c'est un ObjectId ou une chaîne avec préfixe "temp-" ou non défini
            return v === undefined || v === 'undefined' || 
                   mongoose.Types.ObjectId.isValid(v) || 
                   (typeof v === 'string' && v.startsWith('temp-'));
          },
          message: "L'ID readBy doit être un ObjectId valide ou une chaîne temporaire"
        }
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);