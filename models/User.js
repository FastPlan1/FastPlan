const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },   // ex: "Jean Dupont"
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },   // "patron" ou "chauffeur"
  entrepriseId: {
    type: String,  // ✅ corrigé ici
    default: null
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);
