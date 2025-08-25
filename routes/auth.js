const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { 
  validateUserRegistration, 
  validateUserLogin 
} = require('../utils/validation');

// Public routes
router.post('/register', validateUserRegistration, authController.register);
router.post('/login', validateUserLogin, authController.login);

// Protected routes
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile-picture', authenticateToken, authController.updateProfilePicture);
router.put('/change-password', authenticateToken, authController.changePassword);
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;
