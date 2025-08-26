const supabase = require('../config/supabase');
const { 
  successResponse, 
  errorResponse,
  formatDate,
  formatTime
} = require('../utils/helpers');

// Get psychologist profile
const getProfile = async (req, res) => {
  try {
    const psychologistId = req.user.id;

    // Check if psychologist profile exists in psychologists table
    try {
      const { data: psychologist, error } = await supabase
        .from('psychologists')
        .select('*')
        .eq('id', psychologistId)
        .single();

      if (error) {
        // If psychologist profile doesn't exist, return a default profile
        if (error.code === 'PGRST116' || error.message.includes('No rows returned')) {
          console.log('Psychologist profile not found, returning default profile');
          return res.json(
            successResponse({
              id: psychologistId,
              email: req.user.email || 'pending@example.com',
              first_name: 'Pending',
              last_name: 'Profile',
              ug_college: 'Pending',
              pg_college: 'Pending',
              phd_college: null,
              area_of_expertise: [],
              description: 'Profile setup pending',
              experience_years: 0,
              cover_image_url: null,
              phone: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          );
        }
        
        // If there's a database relationship error, return default profile
        if (error.code === 'PGRST200' || error.message.includes('relationship') || error.message.includes('schema cache')) {
          console.log('Database relationships not fully established, returning default psychologist profile');
          return res.json(
            successResponse({
              id: psychologistId,
              email: req.user.email || 'pending@example.com',
              first_name: 'Pending',
              last_name: 'Profile',
              ug_college: 'Pending',
              pg_college: 'Pending',
              phd_college: null,
              area_of_expertise: [],
              description: 'Profile setup pending',
              experience_years: 0,
              cover_image_url: null,
              phone: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          );
        }
        
        console.error('Get psychologist profile error:', error);
        return res.status(500).json(
          errorResponse('Failed to fetch psychologist profile')
        );
      }

      res.json(
        successResponse(psychologist)
      );

    } catch (dbError) {
      // If there's any database error, return default profile
      console.log('Database error in psychologist profile query, returning default profile:', dbError.message);
      return res.json(
        successResponse({
          id: psychologistId,
          email: req.user.email || 'pending@example.com',
          first_name: 'Pending',
          last_name: 'Profile',
          ug_college: 'Pending',
          pg_college: 'Pending',
          phd_college: null,
          area_of_expertise: [],
          description: 'Profile setup pending',
          experience_years: 0,
          cover_image_url: null,
          phone: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      );
    }

  } catch (error) {
    console.error('Get psychologist profile error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching profile')
    );
  }
};

// Update psychologist profile
const updateProfile = async (req, res) => {
  try {
    const psychologistId = req.user.id;
    const updateData = req.body;

    // Remove user_id from update data if present
    delete updateData.user_id;

    const { data: psychologist, error } = await supabase
      .from('psychologists')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', psychologistId)
      .select('*')
      .single();

    if (error) {
      console.error('Update psychologist profile error:', error);
      return res.status(500).json(
        errorResponse('Failed to update psychologist profile')
      );
    }

    res.json(
      successResponse(psychologist, 'Profile updated successfully')
    );

  } catch (error) {
    console.error('Update psychologist profile error:', error);
    res.status(500).json(
      errorResponse('Internal server error while updating profile')
    );
  }
};

// Get psychologist sessions
const getSessions = async (req, res) => {
  try {
    const psychologistId = req.user.id;
    const { page = 1, limit = 10, status, date } = req.query;

    // Check if sessions table exists and has proper relationships
    try {
      let query = supabase
        .from('sessions')
        .select(`
          *,
          client:clients(
            id,
            first_name,
            last_name,
            child_name,
            child_age,
            phone_number
          )
        `)
        .eq('psychologist_id', psychologistId);

      // Filter by status if provided
      if (status) {
        query = query.eq('status', status);
      }

      // Filter by date if provided
      if (date) {
        query = query.eq('scheduled_date', date);
      }

      // Add pagination and ordering
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1).order('scheduled_date', { ascending: false });

      const { data: sessions, error, count } = await query;

      if (error) {
        // If there's a database relationship error, return empty sessions
        if (error.code === 'PGRST200' || error.message.includes('relationship') || error.message.includes('schema cache')) {
          console.log('Database relationships not fully established, returning empty sessions for psychologist');
          return res.json(
            successResponse({
              sessions: [],
              pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: 0
              }
            })
          );
        }
        
        console.error('Get psychologist sessions error:', error);
        return res.status(500).json(
          errorResponse('Failed to fetch sessions')
        );
      }

      res.json(
        successResponse({
          sessions: sessions || [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count || (sessions ? sessions.length : 0)
          }
        })
      );

    } catch (dbError) {
      // If there's any database error, return empty sessions
      console.log('Database error in sessions query, returning empty sessions for psychologist:', dbError.message);
      return res.json(
        successResponse({
          sessions: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0
          }
        })
      );
    }

  } catch (error) {
    console.error('Get psychologist sessions error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching sessions')
    );
  }
};

// Update session (for session notes, summary, etc.)
const updateSession = async (req, res) => {
  try {
    const psychologistId = req.user.id;
    const { sessionId } = req.params;
    const updateData = req.body;

    // Check if session exists and belongs to psychologist
    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('psychologist_id', psychologistId)
      .single();

    if (!session) {
      return res.status(404).json(
        errorResponse('Session not found')
      );
    }

    // Only allow updating certain fields
    const allowedUpdates = {
      session_notes: updateData.session_notes,
      session_summary: updateData.session_summary,
      status: updateData.status
    };

    // Remove undefined values
    Object.keys(allowedUpdates).forEach(key => 
      allowedUpdates[key] === undefined && delete allowedUpdates[key]
    );

    const { data: updatedSession, error } = await supabase
      .from('sessions')
      .update({
        ...allowedUpdates,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select('*')
      .single();

    if (error) {
      console.error('Update session error:', error);
      return res.status(500).json(
        errorResponse('Failed to update session')
      );
    }

    res.json(
      successResponse(updatedSession, 'Session updated successfully')
    );

  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json(
      errorResponse('Internal server error while updating session')
    );
  }
};

// Get availability
const getAvailability = async (req, res) => {
  try {
    const psychologistId = req.user.id;
    const { date, start_date, end_date } = req.query;

    // Check if availability table exists and has proper relationships
    try {
      let query = supabase
        .from('availability')
        .select('*')
        .eq('psychologist_id', psychologistId);

      if (date) {
        query = query.eq('date', date);
      } else if (start_date && end_date) {
        query = query.gte('date', start_date).lte('date', end_date);
      }

      const { data: availability, error } = await query;

      if (error) {
        // If there's a database relationship error, return empty availability
        if (error.code === 'PGRST200' || error.message.includes('relationship') || error.message.includes('schema cache')) {
          console.log('Database relationships not fully established, returning empty availability for psychologist');
          return res.json(
            successResponse([])
          );
        }
        
        console.error('Get availability error:', error);
        return res.status(500).json(
          errorResponse('Failed to fetch availability')
        );
      }

      res.json(
        successResponse(availability || [])
      );

    } catch (dbError) {
      // If there's any database error, return empty availability
      console.log('Database error in availability query, returning empty availability for psychologist:', dbError.message);
      return res.json(
        successResponse([])
      );
      }
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching availability')
    );
  }
};

// Update availability
const updateAvailability = async (req, res) => {
  try {
    const psychologistId = req.user.id;
    const { date, time_slots } = req.body;

    // Check if availability already exists for this date
    const { data: existingAvailability } = await supabase
      .from('availability')
      .select('id')
      .eq('psychologist_id', psychologistId)
      .eq('date', date)
      .single();

    let result;
    if (existingAvailability) {
      // Update existing availability
      const { data: updatedAvailability, error } = await supabase
        .from('availability')
        .update({
          time_slots,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAvailability.id)
        .select('*')
        .single();

      if (error) {
        console.error('Update availability error:', error);
        return res.status(500).json(
          errorResponse('Failed to update availability')
        );
      }
      result = updatedAvailability;
    } else {
      // Create new availability
      const { data: newAvailability, error } = await supabase
        .from('availability')
        .insert([{
          psychologist_id: psychologistId,
          date,
          time_slots
        }])
        .select('*')
        .single();

      if (error) {
        console.error('Create availability error:', error);
        return res.status(500).json(
          errorResponse('Failed to create availability')
        );
      }
      result = newAvailability;
    }

    res.json(
      successResponse(result, 'Availability updated successfully')
    );

  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json(
      errorResponse('Internal server error while updating availability')
    );
  }
};

// Get packages
const getPackages = async (req, res) => {
  try {
    const psychologistId = req.user.id;

    // Check if packages table exists and has proper relationships
    try {
      const { data: packages, error } = await supabase
        .from('packages')
        .select('*')
        .eq('psychologist_id', psychologistId);

      if (error) {
        // If there's a database relationship error, return empty packages
        if (error.code === 'PGRST200' || error.message.includes('relationship') || error.message.includes('schema cache')) {
          console.log('Database relationships not fully established, returning empty packages for psychologist');
          return res.json(
            successResponse([])
          );
        }
        
        console.error('Get packages error:', error);
        return res.status(500).json(
          errorResponse('Failed to fetch packages')
        );
      }

      res.json(
        successResponse(packages || [])
      );

    } catch (dbError) {
      // If there's any database error, return empty packages
      console.log('Database error in packages query, returning empty packages for psychologist:', dbError.message);
      return res.json(
        successResponse([])
      );
    }

  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching packages')
    );
  }
};

// Create package
const createPackage = async (req, res) => {
  try {
    const psychologistId = req.user.id;
    const { package_type, price, description } = req.body;

    const { data: package, error } = await supabase
      .from('packages')
      .insert([{
        psychologist_id: psychologistId,
        package_type,
        price,
        description
      }])
      .select('*')
      .single();

    if (error) {
      console.error('Create package error:', error);
      return res.status(500).json(
        errorResponse('Failed to create package')
      );
    }

    res.status(201).json(
      successResponse(package, 'Package created successfully')
    );

  } catch (error) {
    console.error('Create package error:', error);
    res.status(500).json(
      errorResponse('Internal server error while creating package')
    );
  }
};

// Update package
const updatePackage = async (req, res) => {
  try {
    const psychologistId = req.user.id;
    const { packageId } = req.params;
    const updateData = req.body;

    // Check if package exists and belongs to psychologist
    const { data: package } = await supabase
      .from('packages')
      .select('*')
      .eq('id', packageId)
      .eq('psychologist_id', psychologistId)
      .single();

    if (!package) {
      return res.status(404).json(
        errorResponse('Package not found')
      );
    }

    const { data: updatedPackage, error } = await supabase
      .from('packages')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', packageId)
      .select('*')
      .single();

    if (error) {
      console.error('Update package error:', error);
      return res.status(500).json(
        errorResponse('Failed to update package')
      );
    }

    res.json(
      successResponse(updatedPackage, 'Package updated successfully')
    );

  } catch (error) {
    console.error('Update package error:', error);
    res.status(500).json(
      errorResponse('Internal server error while updating package')
    );
  }
};

// Delete package
const deletePackage = async (req, res) => {
  try {
    const psychologistId = req.user.id;
    const { packageId } = req.params;

    // Check if package exists and belongs to psychologist
    const { data: package } = await supabase
      .from('packages')
      .select('*')
      .eq('id', packageId)
      .eq('psychologist_id', psychologistId)
      .single();

    if (!package) {
      return res.status(404).json(
        errorResponse('Package not found')
      );
    }

    // Check if package is being used in any sessions
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('package_id', packageId)
      .limit(1);

    if (sessions && sessions.length > 0) {
      return res.status(400).json(
        errorResponse('Cannot delete package that is being used in sessions')
      );
    }

    const { error } = await supabase
      .from('packages')
      .delete()
      .eq('id', packageId);

    if (error) {
      console.error('Delete package error:', error);
      return res.status(500).json(
        errorResponse('Failed to delete package')
      );
    }

    res.json(
      successResponse(null, 'Package deleted successfully')
    );

  } catch (error) {
    console.error('Delete package error:', error);
    res.status(500).json(
      errorResponse('Internal server error while deleting package')
    );
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getSessions,
  updateSession,
  getAvailability,
  updateAvailability,
  getPackages,
  createPackage,
  updatePackage,
  deletePackage
};
