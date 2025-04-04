const mongoose = require("mongoose");

const CodeInvitationSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    used: { type: Boolean, default: false },
    patron: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // ou "Employee" selon ton système d'auth
        required: true
    },
    createdAt: { type: Date, default: Date.now }
});

// ✅ Empêche OverwriteModelError
module.exports = mongoose.models.CodeInvitation || mongoose.model("CodeInvitation", CodeInvitationSchema);
