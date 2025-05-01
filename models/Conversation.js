const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" }, // nom du groupe (ou vide pour une conversation privée)
    isGroup: { type: Boolean, default: false }, // true = groupe, false = privé
    members: [
      {
        type: mongoose.Schema.Types.Mixed, // Accepte ObjectId ou string pour les IDs temporaires
        ref: "User",
        required: true,
        validate: {
          validator: function(v) {
            // Valide si c'est un ObjectId ou une chaîne avec préfixe "temp-" ou non défini
            return v === undefined || v === 'undefined' || 
                   mongoose.Types.ObjectId.isValid(v) || 
                   (typeof v === 'string' && v.startsWith('temp-'));
          },
          message: "L'ID membre doit être un ObjectId valide ou une chaîne temporaire"
        }
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.Mixed, // Accepte ObjectId ou string pour les IDs temporaires
      ref: "User",
      validate: {
        validator: function(v) {
          // Valide si c'est un ObjectId ou une chaîne avec préfixe "temp-" ou non défini
          return v === undefined || v === 'undefined' || 
                 mongoose.Types.ObjectId.isValid(v) || 
                 (typeof v === 'string' && v.startsWith('temp-'));
        },
        message: "L'ID createdBy doit être un ObjectId valide ou une chaîne temporaire"
      }
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);