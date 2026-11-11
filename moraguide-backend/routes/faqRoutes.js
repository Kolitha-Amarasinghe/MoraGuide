const express = require('express');
const controller = require('../controllers/faqController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.route('/')
    .get(controller.list)
    .post(requireAuth, requireRole('admin'), controller.create);
router.route('/:id')
    .get(controller.get)
    .put(requireAuth, requireRole('admin'), controller.update)
    .delete(requireAuth, requireRole('admin'), controller.remove);

module.exports = router;
