const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  entrepriseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  type: {
    type: String,
    required: true,
    enum: [
      "new_trip",
      "trip_update",
      "trip_assigned",
      "trip_cancelled",
      "trip_completed",
      "vehicle_update",
      "employee_added",
      "role_update",
      "emergency",
      "message",
      "system"
    ]
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  read: {
    type: Boolean,
    default: false
  },
  urgent: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date
  },
  actions: [{
    label: String,
    action: String,
    data: mongoose.Schema.Types.Mixed
  }]
}, { timestamps: true });

// TTL index for automatic expiration
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for faster querying
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);