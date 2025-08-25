const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// User management
router.get('/users', adminController.getAllUsers);
router.get('/users/:userId', adminController.getUserDetails);
router.put('/users/:userId/role', adminController.updateUserRole);
router.put('/users/:userId/deactivate', adminController.deactivateUser);

// Platform statistics
router.get('/stats/platform', adminController.getPlatformStats);

// User search
router.get('/search/users', adminController.searchUsers);

// Psychologist management
router.post('/psychologists', adminController.createPsychologist);
router.put('/psychologists/:psychologistId', adminController.updatePsychologist);
router.delete('/psychologists/:psychologistId', adminController.deletePsychologist);

// User management
router.post('/users', adminController.createUser);
router.put('/users/:userId', adminController.updateUser);
router.delete('/users/:userId', adminController.deleteUser);

module.exports = router;
