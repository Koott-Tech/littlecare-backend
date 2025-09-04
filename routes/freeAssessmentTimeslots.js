const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/auth');
const {
  getFreeAssessmentTimeslots,
  getAvailabilityRange,
  addTimeslot,
  addMultipleTimeslots,
  updateTimeslot,
  deleteTimeslot,
  bulkUpdateTimeslots,
  saveDateConfig,
  getDateConfig,
  deleteDateConfig,
  getDateConfigsRange
} = require('../controllers/freeAssessmentTimeslotController');

// Get all timeslots
router.get('/', authenticateToken, requireAdmin, getFreeAssessmentTimeslots);

// Get availability range for admin calendar
router.get('/availability-range', authenticateToken, requireAdmin, getAvailabilityRange);

// Add new timeslot
router.post('/', authenticateToken, requireAdmin, addTimeslot);

// Add multiple timeslots in bulk
router.post('/bulk', authenticateToken, requireAdmin, addMultipleTimeslots);

// Update timeslot
router.put('/:id', authenticateToken, requireAdmin, updateTimeslot);

// Delete timeslot
router.delete('/:id', authenticateToken, requireAdmin, deleteTimeslot);

// Bulk update timeslots
router.put('/bulk/update', authenticateToken, requireAdmin, bulkUpdateTimeslots);

// Date-specific configuration routes
router.post('/date-config', authenticateToken, requireAdmin, saveDateConfig);
router.get('/date-config/:date', authenticateToken, requireAdmin, getDateConfig);
router.delete('/date-config/:date', authenticateToken, requireAdmin, deleteDateConfig);
router.get('/date-configs-range', authenticateToken, requireAdmin, getDateConfigsRange);

module.exports = router;
