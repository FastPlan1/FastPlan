const mongoose = require("mongoose");

const maintenanceEntrySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  type: {
    type: String,
    required: true,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  cost: {
    type: Number,
    default: 0
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: false });

const vehicleSchema = new mongoose.Schema({
  entrepriseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  registrationNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    unique: true
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ["berline", "citadine", "SUV", "monospace", "utilitaire", "bus", "autre"],
    default: "berline"
  },
  year: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear() + 1
  },
  seats: {
    type: Number,
    min: 1,
    max: 60,
    default: 5
  },
  fuelType: {
    type: String,
    enum: ["essence", "diesel", "électrique", "hybride", "GPL", "autre"],
    default: "essence"
  },
  status: {
    type: String,
    enum: ["active", "maintenance", "inactive"],
    default: "active"
  },
  features: [{
    type: String,
    trim: true
  }],
  mileage: {
    type: Number,
    default: 0,
    min: 0
  },
  lastMaintenanceDate: {
    type: Date
  },
  nextMaintenanceDate: {
    type: Date
  },
  nextMaintenanceKm: {
    type: Number,
    min: 0
  },
  maintenanceHistory: [maintenanceEntrySchema],
  active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

// Index pour recherche plus rapide
vehicleSchema.index({ registrationNumber: 1 });
vehicleSchema.index({ status: 1 });
vehicleSchema.index({ entrepriseId: 1, status: 1 });

module.exports = mongoose.model("Vehicle", vehicleSchema);