const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Generate JWT token
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

// Hash password
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Compare password
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Generate UUID
const generateUUID = () => {
  return uuidv4();
};

// Format date for database
const formatDate = (date) => {
  // Use Indian Standard Time (IST) - UTC+5:30
  const inputDate = new Date(date);
  return inputDate.toISOString().split('T')[0];
};

// Format time for database
const formatTime = (time) => {
  if (typeof time === 'string') {
    // If it's already a string, ensure it has seconds format (HH:MM:SS)
    if (time.length === 5) {
      return time + ':00'; // Add seconds if missing
    }
    return time;
  }
  return time.toTimeString().slice(0, 8); // Include seconds (HH:MM:SS)
};

// Check if date is in the future
const isFutureDate = (date) => {
  const inputDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return inputDate > today;
};

// Check if time slot is available
const isTimeSlotAvailable = (timeSlot, bookedSlots) => {
  return !bookedSlots.includes(timeSlot);
};

// Calculate session price based on package
const calculateSessionPrice = (packageType, basePrice) => {
  const multipliers = {
    'individual': 1,
    'package_2': 0.9, // 10% discount
    'package_4': 0.8  // 20% discount
  };
  
  return basePrice * (multipliers[packageType] || 1);
};

// Generate invoice number
const generateInvoiceNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `INV-${timestamp}-${random}`;
};

// Sanitize phone number
const sanitizePhoneNumber = (phone) => {
  return phone.replace(/[^\d+]/g, '');
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

// Get time slots between start and end time
const getTimeSlots = (startTime, endTime, interval = 30) => {
  const slots = [];
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  
  while (start < end) {
    slots.push(start.toTimeString().slice(0, 5));
    start.setMinutes(start.getMinutes() + interval);
  }
  
  return slots;
};

// Check if user can access resource
const canAccessResource = (userRole, resourceOwnerId, userId) => {
  if (userRole === 'superadmin') return true;
  if (userRole === 'admin') return true;
  return resourceOwnerId === userId;
};

// Generate random string
const generateRandomString = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Pagination helper
const getPaginationParams = (page = 1, limit = 10) => {
  const offset = (page - 1) * limit;
  return { offset, limit, page: parseInt(page), limit: parseInt(limit) };
};

// Response wrapper
const successResponse = (data, message = 'Success') => {
  return {
    success: true,
    message,
    data
  };
};

const errorResponse = (message, error = null, statusCode = 400) => {
  return {
    success: false,
    message,
    error,
    statusCode
  };
};

module.exports = {
  generateToken,
  hashPassword,
  comparePassword,
  generateUUID,
  formatDate,
  formatTime,
  isFutureDate,
  isTimeSlotAvailable,
  calculateSessionPrice,
  generateInvoiceNumber,
  sanitizePhoneNumber,
  isValidEmail,
  formatCurrency,
  getTimeSlots,
  canAccessResource,
  generateRandomString,
  getPaginationParams,
  successResponse,
  errorResponse
};
