const express = require('express');
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
    try {
        const { message, patronId } = req.body;
        const notification = new Notification({ message, patronId });
        await notification.save();

        res.status(201).json(notification);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
