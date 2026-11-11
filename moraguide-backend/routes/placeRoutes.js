const express = require('express');
const controller = require('../controllers/placeController');
const favoriteController = require('../controllers/favoriteController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.get('/favorites', requireAuth, requireRole('student'), favoriteController.list);
router.post('/:id/favorite', requireAuth, requireRole('student'), favoriteController.add);
router.delete('/:id/favorite', requireAuth, requireRole('student'), favoriteController.remove);
router.route('/')
    .get(controller.list)
    .post(requireAuth, requireRole('admin'), controller.create);
router.route('/:id')
    .get(controller.get)
    .put(requireAuth, requireRole('admin'), controller.update)
    .delete(requireAuth, requireRole('admin'), controller.remove);

module.exports = router;
