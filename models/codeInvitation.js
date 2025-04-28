// models/CodeInvitation.js
const mongoose = require("mongoose");

const CodeInvitationSchema = new mongoose.Schema({
  code:      { type: String, required: true, unique: true },
  used:      { type: Boolean, default: false },
  patron:    {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",   // On référence bien le modèle User
    required: true
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports =
  mongoose.models.CodeInvitation ||
  mongoose.model("CodeInvitation", CodeInvitationSchema);
