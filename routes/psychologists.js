const express = require('express');
const router = express.Router();
const psychologistController = require('../controllers/psychologistController');
const { authenticateToken, requirePsychologist } = require('../middleware/auth');
const { 
  validatePsychologistProfile,
  validatePackage,
  validateAvailability
} = require('../utils/validation');

// All routes require authentication and psychologist role
router.use(authenticateToken);
router.use(requirePsychologist);

// Profile management
router.get('/profile', psychologistController.getProfile);
router.put('/profile', validatePsychologistProfile, psychologistController.updateProfile);

// Session management
router.get('/sessions', psychologistController.getSessions);
router.put('/sessions/:sessionId', psychologistController.updateSession);

// Availability management
router.get('/availability', psychologistController.getAvailability);
router.put('/availability', validateAvailability, psychologistController.updateAvailability);

// Package management
router.get('/packages', psychologistController.getPackages);
router.post('/packages', validatePackage, psychologistController.createPackage);
router.put('/packages/:packageId', validatePackage, psychologistController.updatePackage);
router.delete('/packages/:packageId', psychologistController.deletePackage);

module.exports = router;
