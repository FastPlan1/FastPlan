const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    message: { type: String, required: true },
    chauffeur: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    patron: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vue: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', NotificationSchema);
