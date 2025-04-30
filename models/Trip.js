const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    trim: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  details: {
    type: String,
    trim: true
  }
}, { _id: false });

const passengerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  }
}, { _id: false });

const tripSchema = new mongoose.Schema({
  entrepriseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  reference: {
    type: String,
    unique: true,
    required: true
  },
  chauffeurId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle"
  },
  pickup: locationSchema,
  destination: locationSchema,
  stops: [locationSchema],
  scheduledDate: {
    type: Date,
    required: true
  },
  scheduledTime: {
    type: String,
    required: true
  },
  passengers: [passengerSchema],
  passengerCount: {
    type: Number,
    min: 1,
    default: 1
  },
  clientName: {
    type: String,
    trim: true
  },
  clientPhone: {
    type: String,
    trim: true
  },
  clientEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  status: {
    type: String,
    enum: ["pending", "confirmed", "in_progress", "completed", "cancelled"],
    default: "pending"
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  distance: {
    type: Number,
    min: 0
  },
  duration: {
    type: Number,
    min: 0
  },
  price: {
    type: Number,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "cancelled"],
    default: "pending"
  },
  paymentMethod: {
    type: String,
    enum: ["cash", "card", "transfer", "invoice", "other"],
    default: "cash"
  },
  notes: {
    type: String,
    trim: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  cancelled: {
    type: Boolean,
    default: false
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  path: {
    type: [{
      latitude: Number,
      longitude: Number,
      timestamp: Date
    }],
    default: []
  }
}, { timestamps: true });

// Générer automatiquement une référence unique pour chaque trajet
tripSchema.pre("save", async function(next) {
  if (this.isNew) {
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
    const count = await mongoose.model("Trip").countDocuments({
      createdAt: {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lt: new Date(today.setHours(23, 59, 59, 999))
      }
    });
    
    // Format: TR-YYYYMMDD-XXXX
    this.reference = `TR-${dateStr}-${(count + 1).toString().padStart(4, "0")}`;
  }
  next();
});

// Indexes
tripSchema.index({ reference: 1 });
tripSchema.index({ chauffeurId: 1, scheduledDate: 1 });
tripSchema.index({ entrepriseId: 1, scheduledDate: 1 });
tripSchema.index({ status: 1 });

module.exports = mongoose.model("Trip", tripSchema);