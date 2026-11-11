const express = require('express');
const controller = require('../controllers/eventController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.route('/')
    .get(controller.list)
    .post(requireAuth, requireRole('organizer'), controller.create);
router.get('/mine', requireAuth, requireRole('organizer', 'admin'), controller.listMine);
router.get('/registrations/mine', requireAuth, requireRole('student'), controller.listRegistrations);
router.get('/:id/attendees', requireAuth, requireRole('organizer', 'admin'), controller.listAttendees);
router.post('/:id/registration', requireAuth, requireRole('student'), controller.registerStudent);
router.delete('/:id/registration', requireAuth, requireRole('student'), controller.unregisterStudent);
router.route('/:id')
    .get(controller.getOne)
    .put(requireAuth, requireRole('organizer', 'admin'), controller.update)
    .delete(requireAuth, requireRole('organizer', 'admin'), controller.remove);

module.exports = router;
