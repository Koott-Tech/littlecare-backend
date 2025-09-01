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
router.get('/stats/dashboard', adminController.getPlatformStats); // Alias for dashboard

// User search
router.get('/search/users', adminController.searchUsers);

// Activities
router.get('/activities', adminController.getRecentActivities);

// Recent data for dashboard
router.get('/recent-users', adminController.getRecentUsers);
router.get('/recent-bookings', adminController.getRecentBookings);

// Psychologist management
router.get('/psychologists', adminController.getAllPsychologists);
router.post('/psychologists', adminController.createPsychologist);
router.put('/psychologists/:psychologistId', adminController.updatePsychologist);
router.delete('/psychologists/:psychologistId', adminController.deletePsychologist);

// Package management for psychologists
router.post('/psychologists/:psychologistId/packages', adminController.createPsychologistPackages);

// User management
router.post('/users', adminController.createUser);
router.put('/users/:userId', adminController.updateUser);
router.delete('/users/:userId', adminController.deleteUser);

module.exports = router;
