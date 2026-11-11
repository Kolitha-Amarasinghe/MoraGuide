const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/authController');
const { optionalAuth, requireAuth } = require('../middleware/auth');

const router = express.Router();
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again later.' }
});

router.post('/login', loginLimiter, controller.login);
router.post('/register', loginLimiter, controller.register);
router.get('/me', optionalAuth, controller.current);
router.post('/logout', requireAuth, controller.logout);
router.patch('/profile', requireAuth, controller.updateProfile);
router.get('/profile/image', requireAuth, controller.getProfileImage);
router.put('/profile/image', requireAuth, express.raw({
    type: ['image/jpeg', 'image/png', 'image/webp'],
    limit: '2mb'
}), controller.uploadProfileImage);
router.delete('/profile/image', requireAuth, controller.deleteProfileImage);

module.exports = router;
