const supabase = require('../config/supabase');
const { 
  successResponse, 
  errorResponse,
  formatDate,
  formatTime
} = require('../utils/helpers');
const { createMeetEvent } = require('../utils/meetEventHelper'); // Use OAuth2 approach for real Meet links
const emailService = require('../utils/emailService');
const availabilityService = require('../utils/availabilityCalendarService');

// Book a new session
const bookSession = async (req, res) => {
  try {
    const { psychologist_id, scheduled_date, scheduled_time, price } = req.body;

    // Validate required fields
    if (!psychologist_id || !scheduled_date || !scheduled_time) {
      return res.status(400).json(
        errorResponse('Missing required fields: psychologist_id, scheduled_date, scheduled_time')
      );
    }

    // Get client_id from authenticated user
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user is a client
    if (userRole !== 'client') {
      return res.status(403).json(
        errorResponse('Only clients can book sessions')
      );
    }

    // Get client profile from clients table
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (clientError || !client) {
      console.error('Client profile not found:', clientError);
      return res.status(404).json(
        errorResponse('Client profile not found. Please complete your profile first.')
      );
    }

    const clientId = client.id;

    // Check if the time slot is available using availability service
    console.log('🔍 Checking time slot availability...');
    const isAvailable = await availabilityService.isTimeSlotAvailable(
      psychologist_id, 
      scheduled_date, 
      scheduled_time
    );

    if (!isAvailable) {
      return res.status(400).json(
        errorResponse('This time slot is not available. Please select another time.')
      );
    }

    console.log('✅ Time slot is available');

    // Get client and psychologist details for Google Calendar
    const { data: clientDetails, error: clientDetailsError } = await supabase
      .from('clients')
      .select(`
        first_name, 
        last_name, 
        child_name,
        user:users(email)
      `)
      .eq('id', clientId)
      .single();

    if (clientDetailsError || !clientDetails) {
      console.error('Error fetching client details:', clientDetailsError);
      return res.status(500).json(
        errorResponse('Failed to fetch client details')
      );
    }

    const { data: psychologistDetails, error: psychologistDetailsError } = await supabase
      .from('psychologists')
      .select('first_name, last_name, email')
      .eq('id', psychologist_id)
      .single();

    if (psychologistDetailsError || !psychologistDetails) {
      console.error('Error fetching psychologist details:', psychologistDetailsError);
      return res.status(500).json(
        errorResponse('Failed to fetch psychologist details')
      );
    }

                // Create Google Calendar event with OAuth2 Meet service
            let meetData = null;
            try {
              console.log('🔄 Creating Google Meet meeting via OAuth2...');
              
              // Convert date and time to ISO format for Meet service
              const startDateTime = new Date(`${scheduled_date}T${scheduled_time}`);
              const endDateTime = new Date(startDateTime.getTime() + 60 * 60000); // 60 minutes
              
              meetData = await createMeetEvent({
                summary: `Therapy Session - ${clientDetails.child_name || clientDetails.first_name} with ${psychologistDetails.first_name}`,
                description: `Online therapy session between ${clientDetails.child_name || clientDetails.first_name} and ${psychologistDetails.first_name} ${psychologistDetails.last_name}`,
                startISO: startDateTime.toISOString(),
                endISO: endDateTime.toISOString(),
                attendees: [
                  { email: clientDetails.user?.email, displayName: clientDetails.child_name || `${clientDetails.first_name} ${clientDetails.last_name}` },
                  { email: psychologistDetails.email, displayName: `${psychologistDetails.first_name} ${psychologistDetails.last_name}` }
                ],
                location: 'Online via Google Meet'
              });
              
              console.log('✅ OAuth2 Google Meet meeting created successfully:', meetData);
              console.log('✅ Real Meet link generated:', meetData.meetLink);
              
            } catch (meetError) {
              console.error('❌ Error creating OAuth2 meeting:', meetError);
              console.log('⚠️ Continuing with session creation without meet link...');
              // Continue with session creation even if meet creation fails
            }

    // Create the session with Google Calendar data
    const sessionData = {
      client_id: clientId,
      psychologist_id,
      scheduled_date,
      scheduled_time,
      status: 'booked',
      session_notes: req.body.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add meet data if available
    if (meetData) {
      sessionData.google_calendar_event_id = meetData.eventId;
      sessionData.google_meet_link = meetData.meetLink;
      sessionData.google_meet_join_url = meetData.meetLink;
      sessionData.google_meet_start_url = meetData.meetLink;
    }

    const { data: session, error: createError } = await supabase
      .from('sessions')
      .insert(sessionData)
      .select()
      .single();

    if (createError) {
      console.error('Create session error:', createError);
      return res.status(500).json(
        errorResponse('Failed to create session')
      );
    }

    // Update availability to block this time slot
    try {
      await availabilityService.updateAvailabilityOnBooking(
        psychologist_id, 
        scheduled_date, 
        scheduled_time
      );
      console.log('✅ Availability updated for booked time slot');
    } catch (availabilityError) {
      console.error('Error updating availability:', availabilityError);
      // Continue even if availability update fails
    }

    // Send confirmation emails to all parties
    try {
      await emailService.sendSessionConfirmation({
        clientName: clientDetails.child_name || `${clientDetails.first_name} ${clientDetails.last_name}`,
        psychologistName: `${psychologistDetails.first_name} ${psychologistDetails.last_name}`,
        clientEmail: clientDetails.user?.email,
        psychologistEmail: psychologistDetails.email,
        scheduledDate: scheduled_date,
        scheduledTime: scheduled_time,
        googleMeetLink: meetData?.meetLink,
        sessionId: session.id
      });
      console.log('✅ Session confirmation emails sent successfully');
    } catch (emailError) {
      console.error('Error sending confirmation emails:', emailError);
      // Continue even if email sending fails
    }

    res.status(201).json(
      successResponse({
        session,
        message: 'Session booked successfully'
      })
    );

  } catch (error) {
    console.error('Book session error:', error);
    res.status(500).json(
      errorResponse('Internal server error while booking session')
    );
  }
};

// Get all sessions (admin only)
const getAllSessions = async (req, res) => {
  try {
    console.log('getAllSessions called with user:', req.user);
    
    // Check if user is admin
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
      console.log('Access denied - user role:', req.user?.role);
      return res.status(403).json(
        errorResponse('Access denied. Admin role required.')
      );
    }

    const { page = 1, limit = 10, status, psychologist_id, client_id, date, sort = 'created_at', order = 'desc' } = req.query;

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
          phone_number,
          user:users(
            email
          )
        ),
        psychologist:psychologists(
          id,
          first_name,
          last_name,
          area_of_expertise,
          email
        )
      `);

    console.log('Supabase query built, executing...');

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (psychologist_id) {
      query = query.eq('psychologist_id', psychologist_id);
    }
    if (client_id) {
      query = query.eq('client_id', client_id);
    }
    if (date) {
      query = query.eq('scheduled_date', date);
    }

    // Apply sorting
    if (sort && order) {
      query = query.order(sort, { ascending: order === 'asc' });
    }

    // Add pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    console.log('Executing query with filters and pagination...');
    const { data: sessions, error, count } = await query;
    console.log('Query result:', { sessionsCount: sessions?.length, error, count });

    if (error) {
      console.error('Get all sessions error:', error);
      return res.status(500).json(
        errorResponse('Failed to fetch sessions')
      );
    }

    res.json(
      successResponse({
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || sessions.length
        }
      })
    );

  } catch (error) {
    console.error('Get all sessions error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching sessions')
    );
  }
};

// Get sessions for a specific client
const getClientSessions = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    let query = supabase
      .from('sessions')
      .select(`
        *,
        psychologist:psychologists(
          id,
          first_name,
          last_name,
          area_of_expertise,
          email
        )
      `)
      .eq('client_id', clientId);

    if (status) {
      query = query.eq('status', status);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1).order('scheduled_date', { ascending: false });

    const { data: sessions, error, count } = await query;

    if (error) {
      console.error('Get client sessions error:', error);
      return res.status(500).json(
        errorResponse('Failed to fetch client sessions')
      );
    }

    // Debug: Log session times being returned to frontend
    if (sessions && sessions.length > 0) {
      console.log('🔍 Sessions being returned to dashboard:');
      sessions.forEach((session, index) => {
        console.log(`   Session ${index + 1}:`);
        console.log(`   - Date: ${session.scheduled_date}`);
        console.log(`   - Time: ${session.scheduled_time}`);
        console.log(`   - Status: ${session.status}`);
      });
    }

    res.json(
      successResponse({
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || sessions.length
        }
      })
    );

  } catch (error) {
    console.error('Get client sessions error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching client sessions')
    );
  }
};

// Get sessions for a specific psychologist
const getPsychologistSessions = async (req, res) => {
  try {
    const { psychologistId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

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

    if (status) {
      query = query.eq('status', status);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1).order('scheduled_date', { ascending: false });

    const { data: sessions, error, count } = await query;

    if (error) {
      console.error('Get psychologist sessions error:', error);
      return res.status(500).json(
        errorResponse('Failed to fetch psychologist sessions')
      );
    }

    res.json(
      successResponse({
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || sessions.length
        }
      })
    );

  } catch (error) {
    console.error('Get psychologist sessions error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching psychologist sessions')
    );
  }
};

// Get session by ID
const getSessionById = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const { data: session, error } = await supabase
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
        ),
        psychologist:psychologists(
          id,
          first_name,
          last_name,
          area_of_expertise,
          description,
          email
        ),
        package:packages(
          id,
          package_type,
          price,
          description
        )
      `)
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error('Get session error:', error);
      return res.status(404).json(
        errorResponse('Session not found')
      );
    }

    res.json(
      successResponse(session)
    );

  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching session')
    );
  }
};

// Update session status (admin only)
const updateSessionStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json(
        errorResponse('Status is required')
      );
    }

    // Check if session exists
    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return res.status(404).json(
        errorResponse('Session not found')
      );
    }

    const updateData = { status };
    if (notes) {
      updateData.session_notes = notes;
    }

    const { data: updatedSession, error } = await supabase
      .from('sessions')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select('*')
      .single();

    if (error) {
      console.error('Update session status error:', error);
      return res.status(500).json(
        errorResponse('Failed to update session status')
      );
    }

    res.json(
      successResponse(updatedSession, 'Session status updated successfully')
    );

  } catch (error) {
    console.error('Update session status error:', error);
    res.status(500).json(
      errorResponse('Internal server error while updating session status')
    );
  }
};

// Reschedule session
const rescheduleSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { new_date, new_time } = req.body;

    if (!new_date || !new_time) {
      return res.status(400).json(
        errorResponse('New date and time are required')
      );
    }

    // Check if session exists
    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return res.status(404).json(
        errorResponse('Session not found')
      );
    }

    // Check if new date is in the future
    const sessionDate = new Date(new_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (sessionDate <= today) {
      return res.status(400).json(
        errorResponse('New session date must be in the future')
      );
    }

    // Check if new time slot is available
    const { data: availability } = await supabase
      .from('availability')
      .select('time_slots')
      .eq('psychologist_id', session.psychologist_id)
      .eq('date', new_date)
      .eq('is_available', true)
      .single();

    if (!availability || !availability.time_slots.includes(new_time)) {
      return res.status(400).json(
        errorResponse('Selected time slot is not available')
      );
    }

    // Check if new time slot is already booked
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('id')
      .eq('psychologist_id', session.psychologist_id)
      .eq('scheduled_date', new_date)
      .eq('scheduled_time', new_time)
      .in('status', ['booked', 'rescheduled'])
      .neq('id', sessionId)
      .single();

    if (existingSession) {
      return res.status(400).json(
        errorResponse('This time slot is already booked')
      );
    }

    // COMMENTED OUT: Google Calendar sync (Update Google Calendar event if it exists)
    /* 
    if (session.google_calendar_event_id) {
      try {
        const { data: clientDetails } = await supabase
          .from('clients')
          .select('first_name, last_name, child_name')
          .eq('id', session.client_id)
          .single();

        const { data: psychologistDetails } = await supabase
          .from('psychologists')
          .select('first_name, last_name')
          .eq('id', session.psychologist_id)
          .single();

        if (clientDetails && psychologistDetails) {
          await googleCalendarService.updateSessionEvent(session.google_calendar_event_id, {
            clientName: clientDetails.child_name || `${clientDetails.first_name} ${clientDetails.last_name}`,
            psychologistName: `${psychologistDetails.first_name} ${psychologistDetails.last_name}`,
            scheduledDate: new_date,
            scheduledTime: new_time,
            duration: 60
          });
        }
    */
    
    // Get client and psychologist details for email notifications
    if (true) { // Always fetch for email notifications
      try {
        const { data: clientDetails } = await supabase
          .from('clients')
          .select('first_name, last_name, child_name')
          .eq('id', session.client_id)
          .single();

        const { data: psychologistDetails } = await supabase
          .from('psychologists')
          .select('first_name, last_name')
          .eq('id', session.psychologist_id)
          .single();

        // Send reschedule notification emails
        try {
          await emailService.sendRescheduleNotification({
            clientName: clientDetails.child_name || `${clientDetails.first_name} ${clientDetails.last_name}`,
            psychologistName: `${psychologistDetails.first_name} ${psychologistDetails.last_name}`,
            clientEmail: clientDetails.user?.email,
            psychologistEmail: psychologistDetails.email,
            scheduledDate: new_date,
            scheduledTime: new_time,
            sessionId: session.id
          }, session.scheduled_date, session.scheduled_time);
          console.log('Reschedule notification emails sent successfully');
        } catch (emailError) {
          console.error('Error sending reschedule notification emails:', emailError);
          // Continue even if email sending fails
        }
      } catch (googleError) {
        console.error('Error updating Google Calendar event:', googleError);
        // Continue with session update even if Google Calendar fails
      }
    }

    // Update session
    const { data: updatedSession, error } = await supabase
      .from('sessions')
      .update({
        scheduled_date: formatDate(new_date),
        scheduled_time: formatTime(new_time),
        status: 'rescheduled',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select('*')
      .single();

    if (error) {
      console.error('Reschedule session error:', error);
      return res.status(500).json(
        errorResponse('Failed to reschedule session')
      );
    }

    res.json(
      successResponse(updatedSession, 'Session rescheduled successfully')
    );

  } catch (error) {
    console.error('Reschedule session error:', error);
    res.status(500).json(
      errorResponse('Internal server error while rescheduling session')
    );
  }
};

// Get session statistics
const getSessionStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = supabase
      .from('sessions')
      .select('status, scheduled_date, price');

    if (start_date && end_date) {
      query = query.gte('scheduled_date', start_date).lte('scheduled_date', end_date);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Get session stats error:', error);
      return res.status(500).json(
        errorResponse('Failed to fetch session statistics')
      );
    }

    // Calculate statistics
    const stats = {
      total_sessions: sessions.length,
      total_revenue: sessions.reduce((sum, session) => sum + parseFloat(session.price || 0), 0),
      status_breakdown: {},
      daily_sessions: {}
    };

    sessions.forEach(session => {
      // Status breakdown
      stats.status_breakdown[session.status] = (stats.status_breakdown[session.status] || 0) + 1;
      
      // Daily sessions
      const date = session.scheduled_date;
      stats.daily_sessions[date] = (stats.daily_sessions[date] || 0) + 1;
    });

    res.json(
      successResponse(stats)
    );

  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching session statistics')
    );
  }
};

// Search sessions
const searchSessions = async (req, res) => {
  try {
    const { 
      query: searchQuery, 
      page = 1, 
      limit = 10,
      status,
      psychologist_id,
      client_id,
      start_date,
      end_date
    } = req.query;

    let supabaseQuery = supabase
      .from('sessions')
      .select(`
        *,
        client:clients(
          id,
          first_name,
          last_name,
          child_name
        ),
        psychologist:psychologists(
          id,
          first_name,
          last_name,
          email
        ),
        package:packages(
          id,
          package_type,
          price
        )
      `);

    // Apply filters
    if (status) {
      supabaseQuery = supabaseQuery.eq('status', status);
    }
    if (psychologist_id) {
      supabaseQuery = supabaseQuery.eq('psychologist_id', psychologist_id);
    }
    if (client_id) {
      supabaseQuery = supabaseQuery.eq('client_id', client_id);
    }
    if (start_date) {
      supabaseQuery = supabaseQuery.gte('scheduled_date', start_date);
    }
    if (end_date) {
      supabaseQuery = supabaseQuery.lte('scheduled_date', end_date);
    }

    // Add pagination
    const offset = (page - 1) * limit;
    supabaseQuery = supabaseQuery.range(offset, offset + limit - 1);

    const { data: sessions, error, count } = await supabaseQuery;

    if (error) {
      console.error('Search sessions error:', error);
      return res.status(500).json(
        errorResponse('Failed to search sessions')
      );
    }

    // Filter by search query if provided
    let filteredSessions = sessions;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredSessions = sessions.filter(session => 
        session.client?.first_name?.toLowerCase().includes(query) ||
        session.client?.last_name?.toLowerCase().includes(query) ||
        session.client?.child_name?.toLowerCase().includes(query) ||
        session.psychologist?.first_name?.toLowerCase().includes(query) ||
        session.psychologist?.last_name?.toLowerCase().includes(query) ||
        session.package?.package_type?.toLowerCase().includes(query)
      );
    }

    res.json(
      successResponse({
        sessions: filteredSessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || filteredSessions.length
        }
      })
    );

  } catch (error) {
    console.error('Search sessions error:', error);
    res.status(500).json(
      errorResponse('Internal server error while searching sessions')
    );
  }
};

// Create session (admin only)
const createSession = async (req, res) => {
  try {
    const { client_id, psychologist_id, package_id, scheduled_date, scheduled_time, notes } = req.body;

    // Validate required fields
    if (!client_id || !psychologist_id || !package_id || !scheduled_date || !scheduled_time) {
      return res.status(400).json(
        errorResponse('Missing required fields: client_id, psychologist_id, package_id, scheduled_date, scheduled_time')
      );
    }

    // Check if client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      return res.status(404).json(
        errorResponse('Client not found')
      );
    }

    // Check if psychologist exists
    const { data: psychologist, error: psychologistError } = await supabase
      .from('psychologists')
      .select('id')
      .eq('id', psychologist_id)
      .single();

    if (psychologistError || !psychologist) {
      return res.status(404).json(
        errorResponse('Psychologist not found')
      );
    }

    // Check if package exists
    const { data: package, error: packageError } = await supabase
      .from('packages')
      .select('id, price')
      .eq('id', package_id)
      .single();

    if (packageError || !package) {
      return res.status(404).json(
        errorResponse('Package not found')
      );
    }

    // Create session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert([{
        client_id,
        psychologist_id,
        package_id,
        scheduled_date,
        scheduled_time,
        status: 'booked',
        notes: notes || '',
        amount: package.price
      }])
      .select('*')
      .single();

    if (sessionError) {
      console.error('Create session error:', sessionError);
      return res.status(500).json(
        errorResponse('Failed to create session')
      );
    }

    res.status(201).json(
      successResponse(session, 'Session created successfully')
    );

  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json(
      errorResponse('Internal server error while creating session')
    );
  }
};

// Delete session (admin only)
const deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check if session exists
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, status')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json(
        errorResponse('Session not found')
      );
    }

    // Only allow deletion of sessions that are not completed
    if (session.status === 'completed') {
      return res.status(400).json(
        errorResponse('Cannot delete completed sessions')
      );
    }

    // COMMENTED OUT: Google Calendar sync (Delete from Google Calendar if event exists)
    /*
    if (session.google_calendar_event_id) {
      try {
        await googleCalendarService.deleteSessionEvent(session.google_calendar_event_id);
      } catch (googleError) {
        console.error('Error deleting Google Calendar event:', googleError);
        // Continue with session deletion even if Google Calendar fails
      }
    }
    */
    console.log('ℹ️  Google Calendar sync disabled - skipping calendar event deletion');

    // Delete session
    const { error: deleteError } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId);

    if (deleteError) {
      console.error('Delete session error:', deleteError);
      return res.status(500).json(
        errorResponse('Failed to delete session')
      );
    }

    res.json(
      successResponse(null, 'Session deleted successfully')
    );

  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json(
      errorResponse('Internal server error while deleting session')
    );
  }
};

// Approve or reject reschedule request (psychologist only)
const handleRescheduleRequest = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { action, reason } = req.body; // action: 'approve' or 'reject'
    const psychologistId = req.user.id;

    console.log('🔄 Handling reschedule request');
    console.log('   - Notification ID:', notificationId);
    console.log('   - Action:', action);
    console.log('   - Psychologist ID:', psychologistId);

    // Validate action
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json(
        errorResponse('Invalid action. Must be "approve" or "reject"')
      );
    }

    // Get the notification and verify it belongs to this psychologist
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('psychologist_id', psychologistId)
      .eq('type', 'reschedule_request')
      .single();

    if (notificationError || !notification) {
      return res.status(404).json(
        errorResponse('Reschedule request not found or access denied')
      );
    }

    // Get the session details
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', notification.session_id)
      .single();

    if (sessionError || !session) {
      return res.status(404).json(
        errorResponse('Session not found')
      );
    }

    if (action === 'approve') {
      // Check if new time slot is still available
      const { data: conflictingSessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('psychologist_id', psychologistId)
        .eq('scheduled_date', notification.metadata.new_date)
        .eq('scheduled_time', notification.metadata.new_time)
        .in('status', ['booked', 'rescheduled', 'confirmed'])
        .neq('id', session.id);

      if (conflictingSessions && conflictingSessions.length > 0) {
        return res.status(400).json(
          errorResponse('Selected time slot is no longer available')
        );
      }

      // Update session with new date/time
      const { data: updatedSession, error: updateError } = await supabase
        .from('sessions')
        .update({
          scheduled_date: notification.metadata.new_date,
          scheduled_time: notification.metadata.new_time,
          status: 'rescheduled',
          reschedule_count: (session.reschedule_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Error updating session:', updateError);
        return res.status(500).json(
          errorResponse('Failed to reschedule session')
        );
      }

      // Create approval notification for client
      const clientNotificationData = {
        psychologist_id: psychologistId,
        type: 'reschedule_approved',
        title: 'Reschedule Approved',
        message: `Your reschedule request has been approved. Session moved to ${notification.metadata.new_date} at ${notification.metadata.new_time}`,
        session_id: session.id,
        client_id: notification.client_id,
        is_read: false,
        created_at: new Date().toISOString()
      };

      await supabase
        .from('notifications')
        .insert([clientNotificationData]);

      // Mark original request as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      console.log('✅ Reschedule request approved');
      res.json(
        successResponse(updatedSession, 'Reschedule request approved successfully')
      );

    } else {
      // Reject the request
      const clientNotificationData = {
        psychologist_id: psychologistId,
        type: 'reschedule_rejected',
        title: 'Reschedule Rejected',
        message: `Your reschedule request has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
        session_id: session.id,
        client_id: notification.client_id,
        is_read: false,
        created_at: new Date().toISOString()
      };

      await supabase
        .from('notifications')
        .insert([clientNotificationData]);

      // Mark original request as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      console.log('❌ Reschedule request rejected');
      res.json(
        successResponse(null, 'Reschedule request rejected successfully')
      );
    }

  } catch (error) {
    console.error('Handle reschedule request error:', error);
    res.status(500).json(
      errorResponse('Internal server error while handling reschedule request')
    );
  }
};

// Complete session with summary, report, and notes (psychologist only)
const completeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { summary, report, summary_notes } = req.body;
    const psychologistId = req.user.id;

    // Validate required fields
    if (!summary || !report || !summary_notes) {
      return res.status(400).json(
        errorResponse('Summary, report, and summary notes are required')
      );
    }

    // Check if session exists and belongs to this psychologist
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select(`
        *,
        client:clients(
          id,
          first_name,
          last_name,
          child_name,
          child_age,
          user_id,
          user:users(email)
        )
      `)
      .eq('id', sessionId)
      .eq('psychologist_id', psychologistId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json(
        errorResponse('Session not found or you do not have permission to complete this session')
      );
    }

    // Check if session is already completed
    if (session.status === 'completed') {
      return res.status(400).json(
        errorResponse('Session is already completed')
      );
    }

    // Update session with completion data
    const { data: updatedSession, error: updateError } = await supabase
      .from('sessions')
      .update({
        status: 'completed',
        summary: summary.trim(),
        report: report.trim(),
        summary_notes: summary_notes.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select(`
        *,
        client:clients(
          id,
          first_name,
          last_name,
          child_name,
          child_age,
          user_id,
          user:users(email)
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating session:', updateError);
      return res.status(500).json(
        errorResponse('Failed to complete session')
      );
    }

    // Send completion notification to client
    try {
      const clientNotificationData = {
        user_id: session.client.user_id,
        title: 'Session Completed',
        message: `Your session with ${req.user.first_name || 'your psychologist'} has been completed. You can now view the summary and report.`,
        type: 'success',
        related_id: sessionId,
        related_type: 'session'
      };

      await supabase
        .from('notifications')
        .insert([clientNotificationData]);

      // Send email notification to client
      if (session.client.user?.email) {
        await emailService.sendSessionCompletionNotification({
          clientName: `${session.client.first_name} ${session.client.last_name}`,
          childName: session.client.child_name,
          psychologistName: req.user.first_name || 'Your Psychologist',
          sessionDate: formatDate(session.scheduled_date),
          sessionTime: formatTime(session.scheduled_time),
          clientEmail: session.client.user.email
        });
      }
    } catch (notificationError) {
      console.error('Error sending completion notification:', notificationError);
      // Don't fail the request if notification fails
    }

    console.log(`✅ Session ${sessionId} completed by psychologist ${psychologistId}`);
    
    res.json(
      successResponse(updatedSession, 'Session completed successfully')
    );

  } catch (error) {
    console.error('Error completing session:', error);
    res.status(500).json(
      errorResponse('Internal server error while completing session')
    );
  }
};

module.exports = {
  bookSession,
  getClientSessions,
  getPsychologistSessions,
  getAllSessions,
  updateSessionStatus,
  deleteSession,
  handleRescheduleRequest,
  completeSession
};
