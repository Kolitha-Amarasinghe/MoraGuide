const express = require('express');
const controller = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));
router.get('/summary', controller.adminSummary);
router.get('/users', controller.adminUsers);

module.exports = router;
