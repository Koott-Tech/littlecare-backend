const express = require('express');
const availabilityService = require('../utils/availabilityCalendarService');
const { successResponse, errorResponse } = require('../utils/helpers');
const router = express.Router();

/**
 * GET /api/availability/psychologist/:id
 * Get psychologist availability for a specific date
 */
router.get('/psychologist/:id', async (req, res, next) => {
  try {
    const { id: psychologistId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json(
        errorResponse('Date parameter is required (YYYY-MM-DD format)')
      );
    }

    console.log(`📅 Getting availability for psychologist ${psychologistId} on ${date}`);

    const availability = await availabilityService.getPsychologistAvailability(psychologistId, date);

    res.json(
      successResponse({
        message: 'Availability retrieved successfully',
        data: availability
      })
    );

  } catch (error) {
    console.error('Error getting psychologist availability:', error);
    next(error);
  }
});

/**
 * GET /api/availability/psychologist/:id/range
 * Get psychologist availability for a date range
 */
router.get('/psychologist/:id/range', async (req, res, next) => {
  try {
    const { id: psychologistId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json(
        errorResponse('Both startDate and endDate parameters are required (YYYY-MM-DD format)')
      );
    }

    console.log(`📅 Getting availability range for psychologist ${psychologistId} from ${startDate} to ${endDate}`);

    const availability = await availabilityService.getPsychologistAvailabilityRange(
      psychologistId, 
      startDate, 
      endDate
    );

    res.json(
      successResponse({
        message: 'Availability range retrieved successfully',
        data: availability
      })
    );

  } catch (error) {
    console.error('Error getting psychologist availability range:', error);
    next(error);
  }
});

/**
 * GET /api/availability/psychologist/:id/check
 * Check if a specific time slot is available
 */
router.get('/psychologist/:id/check', async (req, res, next) => {
  try {
    const { id: psychologistId } = req.params;
    const { date, time } = req.query;

    if (!date || !time) {
      return res.status(400).json(
        errorResponse('Both date and time parameters are required')
      );
    }

    console.log(`🔍 Checking availability for psychologist ${psychologistId} on ${date} at ${time}`);

    const isAvailable = await availabilityService.isTimeSlotAvailable(psychologistId, date, time);

    res.json(
      successResponse({
        message: 'Time slot availability checked successfully',
        data: {
          psychologistId,
          date,
          time,
          isAvailable
        }
      })
    );

  } catch (error) {
    console.error('Error checking time slot availability:', error);
    next(error);
  }
});

/**
 * GET /api/availability/psychologist/:id/working-hours
 * Get psychologist working hours and preferences
 */
router.get('/psychologist/:id/working-hours', async (req, res, next) => {
  try {
    const { id: psychologistId } = req.params;

    console.log(`🕐 Getting working hours for psychologist ${psychologistId}`);

    const workingHours = await availabilityService.getPsychologistWorkingHours(psychologistId);

    res.json(
      successResponse({
        message: 'Working hours retrieved successfully',
        data: workingHours
      })
    );

  } catch (error) {
    console.error('Error getting psychologist working hours:', error);
    next(error);
  }
});

/**
 * GET /api/availability/public/psychologist/:id
 * Public endpoint to get psychologist availability (no authentication required)
 */
router.get('/public/psychologist/:id', async (req, res, next) => {
  try {
    const { id: psychologistId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json(
        errorResponse('Date parameter is required (YYYY-MM-DD format)')
      );
    }

    console.log(`📅 Getting public availability for psychologist ${psychologistId} on ${date}`);

    const availability = await availabilityService.getPsychologistAvailability(psychologistId, date);

    // Filter out sensitive information for public access
    const publicAvailability = {
      date: availability.date,
      psychologistId: availability.psychologistId,
      timeSlots: availability.timeSlots.map(slot => ({
        time: slot.time,
        available: slot.available,
        displayTime: slot.displayTime,
        reason: slot.available ? null : slot.reason
      })),
      totalSlots: availability.totalSlots,
      availableSlots: availability.availableSlots,
      blockedSlots: availability.blockedSlots
    };

    res.json(
      successResponse({
        message: 'Public availability retrieved successfully',
        data: publicAvailability
      })
    );

  } catch (error) {
    console.error('Error getting public availability:', error);
    next(error);
  }
});

module.exports = router;
