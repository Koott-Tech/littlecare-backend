const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied', 
        message: 'No token provided' 
      });
    }

    console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.log('Token received:', token.substring(0, 20) + '...');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
    
    // Check if decoded has userId or id
    const userId = decoded.userId || decoded.id;
    if (!userId) {
      console.error('Token missing userId:', decoded);
      return res.status(401).json({ 
        error: 'Invalid token structure', 
        message: 'Token missing user ID' 
      });
    }
    
    // Check if it's a psychologist first (since login checks psychologists table first)
    const { data: psychologist, error: psychologistError } = await supabase
      .from('psychologists')
      .select('*')
      .eq('id', userId)
      .single();

    if (psychologist && !psychologistError) {
      // Psychologist exists in psychologists table (standalone)
      req.user = {
        id: psychologist.id,
        email: psychologist.email,
        role: 'psychologist',
        created_at: psychologist.created_at,
        updated_at: psychologist.updated_at
      };
      return next();
    }

    // If not a psychologist, check users table for clients/admins
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('User not found in either table:', { userId, userError, psychologistError });
      return res.status(401).json({ 
        error: 'Access denied', 
        message: 'Invalid token' 
      });
    }

    // User exists in users table (client, admin, superadmin)
    req.user = user;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired', 
        message: 'Please login again' 
      });
    }
    
    return res.status(403).json({ 
      error: 'Invalid token', 
      message: 'Access denied' 
    });
  }
};

// Check if user has specific role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Insufficient permissions' 
      });
    }

    next();
  };
};

// Specific role middlewares
const requireClient = requireRole(['client']);
const requirePsychologist = requireRole(['psychologist']);
const requireAdmin = requireRole(['admin', 'superadmin']);
const requireSuperAdmin = requireRole(['superadmin']);

module.exports = {
  authenticateToken,
  requireRole,
  requireClient,
  requirePsychologist,
  requireAdmin,
  requireSuperAdmin
};
