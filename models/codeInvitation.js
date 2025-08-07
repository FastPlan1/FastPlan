// models/CodeInvitation.js
const mongoose = require("mongoose");

const codeInvitationSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  patron: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  used: {
    type: Boolean,
    default: false
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  usedAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours
    }
  }
}, { timestamps: true });

// Index pour améliorer les performances
codeInvitationSchema.index({ code: 1 });
codeInvitationSchema.index({ patron: 1 });
codeInvitationSchema.index({ used: 1 });
codeInvitationSchema.index({ expiresAt: 1 });

module.exports = mongoose.model("codeInvitation", codeInvitationSchema);
