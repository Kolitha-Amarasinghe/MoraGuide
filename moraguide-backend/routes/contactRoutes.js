const express = require('express');
const { rateLimit } = require('express-rate-limit');
const controller = require('../controllers/contactController');

const router = express.Router();
const contactRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many messages submitted. Please try again later.' }
});

router.post('/', contactRateLimit, controller.create);

module.exports = router;
