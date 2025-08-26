const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { 
  validateClientRegistration, 
  validateUserLogin 
} = require('../utils/validation');

// Public routes
router.post('/register/client', validateClientRegistration, authController.registerClient); // Only clients can register
router.post('/login', validateUserLogin, authController.login);
router.get('/registration-info', authController.getRegistrationInfo); // Info about registration policies

// Protected routes
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile-picture', authenticateToken, authController.updateProfilePicture);
router.put('/change-password', authenticateToken, authController.changePassword);
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;
