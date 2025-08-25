const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const psychologistRoutes = require('./routes/psychologists');
const sessionRoutes = require('./routes/sessions');
const adminRoutes = require('./routes/admin');
const superadminRoutes = require('./routes/superadmin');

const app = express();
const PORT = process.env.PORT || 5001;

// Security middleware
app.use(helmet());

// Rate limiting - more lenient in development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 1000 requests in development, 100 in production
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Kuttikal Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Public endpoint to get all psychologists (no authentication required)
app.get('/api/public/psychologists', async (req, res) => {
  try {
    const supabase = require('./config/supabase');

                // Fetch psychologists with their details
            const { data: psychologists, error: psychologistsError } = await supabase
              .from('psychologists')
              .select(`
                id,
                user_id,
                first_name,
                last_name,
                area_of_expertise,
                description,
                experience_years
              `)
              .order('created_at', { ascending: false });

    if (psychologistsError) {
      console.error('Error fetching psychologists:', psychologistsError);
      throw new Error('Failed to fetch psychologists');
    }

    // Fetch user details (email, etc.) for all psychologists
    const userIds = psychologists.map(psych => psych.user_id);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, created_at')
      .in('id', userIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw new Error('Failed to fetch users');
    }

    // Create a map of users by id for easy lookup
    const usersMap = {};
    users.forEach(user => {
      usersMap[user.id] = user;
    });

                // Combine psychologist and user data
            const combinedPsychologists = psychologists.map(psych => {
              const user = usersMap[psych.user_id] || {};
              return {
                id: psych.id,
                name: `${psych.first_name} ${psych.last_name}`.trim(),
                first_name: psych.first_name,
                last_name: psych.last_name,
                email: user.email,
                phone: 'N/A', // Phone number not available in current schema

                area_of_expertise: psych.area_of_expertise || [],
                experience_years: psych.experience_years || 0,
                ug_college: 'N/A', // Not available in current schema
                pg_college: 'N/A', // Not available in current schema
                phd_college: 'N/A', // Not available in current schema
                description: psych.description || 'Professional psychologist dedicated to helping clients achieve mental wellness.',
                profile_picture_url: null, // Not available in current schema
                cover_image_url: null // Not available in current schema
              };
            });

    res.json({
      success: true,
      data: {
        psychologists: combinedPsychologists
      }
    });
  } catch (error) {
    console.error('Error fetching psychologists:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch psychologists',
      message: error.message
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/psychologists', psychologistRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superadminRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Kuttikal Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
