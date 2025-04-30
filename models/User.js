// models/User.js

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,                // ex. "Jean Dupont"
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["chauffeur", "admin", "patron"],  // seuls ces trois rôles sont autorisés
    default: "chauffeur",
    required: true,
  },
  entrepriseId: {
    type: String,
    default: null,
  },
  // ─── Champs de géolocalisation ───
  latitude: {
    type: Number,
    default: null,
  },
  longitude: {
    type: Number,
    default: null,
  },
  updatedAt: {
    type: Date,
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", userSchema);
