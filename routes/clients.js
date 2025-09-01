const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authenticateToken, requireClient } = require('../middleware/auth');
const { 
  validateClientProfile 
} = require('../utils/validation');

// All routes require authentication and client role
router.use(authenticateToken);
router.use(requireClient);

// Profile management
router.get('/profile', clientController.getProfile);
router.put('/profile', validateClientProfile, clientController.updateProfile);

// Session management
router.get('/sessions', clientController.getSessions);
router.get('/sessions/:sessionId', clientController.getSession);
router.post('/book-session', clientController.bookSession);
router.put('/sessions/:sessionId/cancel', clientController.cancelSession);
router.post('/sessions/:sessionId/reschedule-request', clientController.requestReschedule);
router.put('/sessions/:sessionId/reschedule', clientController.rescheduleSession);
router.post('/sessions/:sessionId/feedback', clientController.submitSessionFeedback);

// Psychologist discovery
router.get('/psychologists', clientController.getAvailablePsychologists);
router.get('/psychologists/:psychologistId/packages', clientController.getPsychologistPackages);

// Book remaining session from package
router.post('/book-remaining-session', clientController.bookRemainingSession);

// Get client packages
router.get('/packages', clientController.getClientPackages);

module.exports = router;
