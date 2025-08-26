const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const sessionController = require('../controllers/sessionController');

// Public route for booking sessions (requires client authentication)
router.post('/book', authenticateToken, sessionController.bookSession);

// Protected routes for authenticated users
router.get('/client/:clientId', authenticateToken, sessionController.getClientSessions);
router.get('/psychologist/:psychologistId', authenticateToken, sessionController.getPsychologistSessions);
router.get('/admin/all', authenticateToken, sessionController.getAllSessions);
router.put('/:sessionId/status', authenticateToken, sessionController.updateSessionStatus);
router.delete('/:sessionId', authenticateToken, sessionController.deleteSession);

module.exports = router;
