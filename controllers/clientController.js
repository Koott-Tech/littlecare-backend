const supabase = require('../config/supabase');
const { 
  successResponse, 
  errorResponse,
  formatDate,
  formatTime
} = require('../utils/helpers');

// Get client profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Get client profile error:', error);
      return res.status(500).json(
        errorResponse('Failed to fetch client profile')
      );
    }

    res.json(
      successResponse(client)
    );

  } catch (error) {
    console.error('Get client profile error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching profile')
    );
  }
};

// Update client profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    // Remove user_id from update data if present
    delete updateData.user_id;

    const { data: client, error } = await supabase
      .from('clients')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      console.error('Update client profile error:', error);
      return res.status(500).json(
        errorResponse('Failed to update client profile')
      );
    }

    res.json(
      successResponse(client, 'Profile updated successfully')
    );

  } catch (error) {
    console.error('Update client profile error:', error);
    res.status(500).json(
      errorResponse('Internal server error while updating profile')
    );
  }
};

// Get client sessions
const getSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    // Get client ID
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!client) {
      return res.status(404).json(
        errorResponse('Client profile not found')
      );
    }

    // Check if sessions table exists and has proper relationships
    try {
      let query = supabase
        .from('sessions')
        .select(`
          *,
          psychologist:psychologists(
            id,
            first_name,
            last_name,
            area_of_expertise
          )
        `)
        .eq('client_id', client.id);

      // Filter by status if provided
      if (status) {
        query = query.eq('status', status);
      }

      // Add pagination and ordering
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1).order('scheduled_date', { ascending: false });

      const { data: sessions, error, count } = await query;

      if (error) {
        // If there's a database relationship error, return empty sessions
        if (error.code === 'PGRST200' || error.message.includes('relationship') || error.message.includes('schema cache')) {
          console.log('Database relationships not fully established, returning empty sessions for new client');
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
        
        console.error('Get client sessions error:', error);
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
      // If there's any database error, return empty sessions for new clients
      console.log('Database error in sessions query, returning empty sessions for new client:', dbError.message);
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
    console.error('Get client sessions error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching sessions')
    );
  }
};

// Book a session
const bookSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { psychologist_id, package_id, scheduled_date, scheduled_time, price } = req.body;

    console.log('🚀 ===== SESSION BOOKING DEBUG START =====');
    console.log('📅 Session Booking Request:', {
      psychologist_id,
      package_id,
      scheduled_date,
      scheduled_time,
      price,
      userId,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
    console.log('🔍 Request Headers:', req.headers);
    console.log('🔍 Full Request Body:', req.body);

    // Get client ID
    console.log('🔍 Step 1: Getting client ID for user:', userId);
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .single();

    console.log('👤 Client lookup result:', client);

    if (!client) {
      return res.status(404).json(
        errorResponse('Client profile not found')
      );
    }

    // Check if psychologist exists
    const { data: psychologist } = await supabase
      .from('psychologists')
      .select('id')
      .eq('id', psychologist_id)
      .single();

    if (!psychologist) {
      return res.status(404).json(
        errorResponse('Psychologist not found')
      );
    }

    console.log('🔍 Step 2: Package validation');
    console.log('📦 Package ID provided:', package_id);
    console.log('📦 Package ID type:', typeof package_id);
    console.log('📦 Package ID truthiness:', !!package_id);
    
    let package = null;
    
    // Only validate package if package_id is provided and not null/undefined
    if (package_id && package_id !== 'null' && package_id !== 'undefined') {
      console.log('📦 Validating package...');
      const { data: packageData, error: packageError } = await supabase
        .from('packages')
        .select('*')
        .eq('id', package_id)
        .eq('psychologist_id', psychologist_id)
        .single();

      console.log('📦 Package lookup result:', packageData);
      console.log('📦 Package lookup error:', packageError);

      if (!packageData) {
        console.log('❌ Package validation failed');
        return res.status(400).json(
          errorResponse('Package not found or does not belong to this psychologist')
        );
      }
      
      package = packageData;
      console.log('✅ Package validation passed');
    } else {
      console.log('📦 No package validation needed (package_id not provided)');
    }

    // Check if date is in the future
    const sessionDate = new Date(scheduled_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (sessionDate <= today) {
      return res.status(400).json(
        errorResponse('Session date must be in the future')
      );
    }

    // Check if time slot is available
    console.log('🔍 Step 3: Availability validation');
    console.log('📅 Checking availability for:');
    console.log('   - Psychologist ID:', psychologist_id);
    console.log('   - Date:', scheduled_date);
    console.log('   - Time:', scheduled_time);
    
    // Convert 24-hour time to 12-hour format for availability check
    const convertTo12Hour = (time24) => {
      const [hours, minutes] = time24.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    };
    
    const scheduled_time_12h = convertTo12Hour(scheduled_time);
    console.log('🕐 Time format conversion:');
    console.log('   - 24-hour format:', scheduled_time);
    console.log('   - 12-hour format:', scheduled_time_12h);
    
    const { data: availability, error: availabilityError } = await supabase
      .from('availability')
      .select('time_slots')
      .eq('psychologist_id', psychologist_id)
      .eq('date', scheduled_date)
      .eq('is_available', true)
      .single();

    console.log('📊 Availability query result:', availability);
    console.log('📊 Availability query error:', availabilityError);
    
    if (availability && availability.time_slots) {
      console.log('📋 Available time slots:', availability.time_slots);
      console.log('🔍 Looking for time slot (24h):', scheduled_time);
      console.log('🔍 Looking for time slot (12h):', scheduled_time_12h);
      console.log('📋 Time slot type:', typeof scheduled_time);
      console.log('📋 Available slots types:', availability.time_slots.map(slot => typeof slot));
      console.log('✅ Includes check result (12h):', availability.time_slots.includes(scheduled_time_12h));
    }

    // Check availability using 12-hour format
    if (!availability || !availability.time_slots.includes(scheduled_time_12h)) {
      console.log('❌ Availability check failed');
      console.log('   - Availability exists:', !!availability);
      console.log('   - Time slots:', availability?.time_slots);
      console.log('   - Requested time (24h):', scheduled_time);
      console.log('   - Requested time (12h):', scheduled_time_12h);
      return res.status(400).json(
        errorResponse('Selected time slot is not available')
      );
    }
    
    console.log('✅ Availability check passed');

    // Check if time slot is already booked
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('psychologist_id', psychologist_id)
      .eq('scheduled_date', scheduled_date)
      .eq('scheduled_time', scheduled_time)
      .in('status', ['booked', 'rescheduled'])
      .single();

    if (existingSession) {
      return res.status(400).json(
        errorResponse('This time slot is already booked')
      );
    }

    // Create session
    console.log('🔍 Step 4: Creating session');
    const sessionData = {
      client_id: client.id,
      psychologist_id,
      scheduled_date: formatDate(scheduled_date),
      scheduled_time: formatTime(scheduled_time),
      status: 'booked',
      price: price || (package?.price || 0)
    };
    
    // Only add package_id if it's provided and valid
    if (package_id && package_id !== 'null' && package_id !== 'undefined') {
      sessionData.package_id = package_id;
    }
    
    console.log('💾 Session data to insert:', sessionData);
    
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert([sessionData])
      .select('*')
      .single();

    console.log('💾 Session creation result:', session);
    console.log('💾 Session creation error:', sessionError);

    if (sessionError) {
      console.error('Session booking error:', sessionError);
      return res.status(500).json(
        errorResponse('Failed to book session')
      );
    }

    console.log('✅ Session booking completed successfully');
    console.log('🚀 ===== SESSION BOOKING DEBUG END =====');
    
    res.status(201).json(
      successResponse(session, 'Session booked successfully')
    );

  } catch (error) {
    console.error('❌ BOOKING ERROR:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
    console.log('🚀 ===== SESSION BOOKING DEBUG END (ERROR) =====');
    
    res.status(500).json(
      errorResponse('Internal server error while booking session')
    );
  }
};

// Cancel a session
const cancelSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    // Get client ID
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!client) {
      return res.status(404).json(
        errorResponse('Client profile not found')
      );
    }

    // Check if session exists and belongs to client
    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('client_id', client.id)
      .single();

    if (!session) {
      return res.status(404).json(
        errorResponse('Session not found')
      );
    }

    // Check if session can be cancelled
    if (session.status !== 'booked') {
      return res.status(400).json(
        errorResponse('Only booked sessions can be cancelled')
      );
    }

    // Check if session is in the future
    const sessionDate = new Date(session.scheduled_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (sessionDate <= today) {
      return res.status(400).json(
        errorResponse('Cannot cancel sessions on or before today')
      );
    }

    // Update session status
    const { data: updatedSession, error } = await supabase
      .from('sessions')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select('*')
      .single();

    if (error) {
      console.error('Cancel session error:', error);
      return res.status(500).json(
        errorResponse('Failed to cancel session')
      );
    }

    res.json(
      successResponse(updatedSession, 'Session cancelled successfully')
    );

  } catch (error) {
    console.error('Cancel session error:', error);
    res.status(500).json(
      errorResponse('Internal server error while cancelling session')
    );
  }
};

// Request reschedule for a session
const requestReschedule = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    // Get client ID
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!client) {
      return res.status(404).json(
        errorResponse('Client profile not found')
      );
    }

    // Check if session exists and belongs to client
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('client_id', client.id)
      .single();

    if (sessionError || !session) {
      return res.status(404).json(
        errorResponse('Session not found')
      );
    }

    // Check if session can be rescheduled (only booked sessions)
    if (session.status !== 'booked') {
      return res.status(400).json(
        errorResponse('Only booked sessions can be rescheduled')
      );
    }

    // For now, just change the status to indicate reschedule request
    // TODO: Add reschedule_request field to database schema
    const { data: updatedSession, error: updateError } = await supabase
      .from('sessions')
      .update({
        status: 'reschedule_requested',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Update session status error:', updateError);
      return res.status(500).json(
        errorResponse('Failed to create reschedule request')
      );
    }

    res.json(
      successResponse(updatedSession, 'Reschedule request sent successfully')
    );

  } catch (error) {
    console.error('Request reschedule error:', error);
    res.status(500).json(
      errorResponse('Internal server error while requesting reschedule')
    );
  }
};

// Get available psychologists
const getAvailablePsychologists = async (req, res) => {
  try {
    const { expertise, date } = req.query;

    let query = supabase
      .from('psychologists')
      .select(`
        id,
        first_name,
        last_name,
        area_of_expertise,
        description,
        experience_years,
        cover_image_url,
        packages(id, package_type, price, description)
      `);

    // Filter by expertise if provided
    if (expertise) {
      query = query.contains('area_of_expertise', [expertise]);
    }

    const { data: psychologists, error } = await query;

    if (error) {
      console.error('Get psychologists error:', error);
      return res.status(500).json(
        errorResponse('Failed to fetch psychologists')
      );
    }

    // Filter by availability if date is provided
    if (date) {
      const availablePsychologists = [];
      
      for (const psychologist of psychologists) {
        const { data: availability } = await supabase
          .from('availability')
          .select('time_slots')
          .eq('psychologist_id', psychologist.id)
          .eq('date', date)
          .eq('is_available', true)
          .single();

        if (availability && availability.time_slots.length > 0) {
          psychologist.available_slots = availability.time_slots;
          availablePsychologists.push(psychologist);
        }
      }

      res.json(
        successResponse(availablePsychologists)
      );
    } else {
      res.json(
        successResponse(psychologists)
      );
    }

  } catch (error) {
    console.error('Get psychologists error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching psychologists')
    );
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getSessions,
  bookSession,
  cancelSession,
  getAvailablePsychologists,
  requestReschedule
};
