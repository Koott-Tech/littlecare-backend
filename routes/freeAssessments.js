const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getFreeAssessmentStatus,
  getAvailableTimeSlots,
  getFreeAssessmentAvailabilityRange,
  bookFreeAssessment,
  cancelFreeAssessment,
  testGlobalTimeslots,
  testDateConfigs
} = require('../controllers/freeAssessmentController');

// Get client's free assessment status
router.get('/status', authenticateToken, getFreeAssessmentStatus);

// Get available time slots for free assessments
router.get('/available-slots', authenticateToken, getAvailableTimeSlots);

// Get free assessment availability range for calendar
router.get('/availability-range', authenticateToken, getFreeAssessmentAvailabilityRange);

// Book a free assessment
router.post('/book', authenticateToken, bookFreeAssessment);

// Cancel a free assessment
router.put('/cancel/:assessmentId', authenticateToken, cancelFreeAssessment);

// Test global timeslots
router.get('/test-timeslots', authenticateToken, testGlobalTimeslots);

// Test date-specific configurations
router.get('/test-date-configs', authenticateToken, testDateConfigs);

module.exports = router;
