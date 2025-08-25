const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { 
  validateSessionUpdate
} = require('../utils/validation');

// Public routes (no authentication required)
router.get('/:sessionId', sessionController.getSessionById);

// Admin routes (require authentication and admin role)
router.use(authenticateToken);
router.use(requireAdmin);

router.post('/', sessionController.createSession);
router.get('/', sessionController.getAllSessions);
router.put('/:sessionId/status', validateSessionUpdate, sessionController.updateSessionStatus);
router.put('/:sessionId/reschedule', sessionController.rescheduleSession);
router.delete('/:sessionId', sessionController.deleteSession);
router.get('/stats/overview', sessionController.getSessionStats);
router.get('/search/advanced', sessionController.searchSessions);

module.exports = router;
