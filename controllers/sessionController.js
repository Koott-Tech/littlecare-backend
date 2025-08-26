const supabase = require('../config/supabase');
const { 
  successResponse, 
  errorResponse,
  formatDate,
  formatTime
} = require('../utils/helpers');

// Get all sessions (admin only)
const getAllSessions = async (req, res) => {
  try {
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
          phone_number
        ),
        psychologist:psychologists(
          id,
          first_name,
          last_name,
          area_of_expertise,
          email
        ),
        package:packages(
          id,
          package_type,
          price,
          description
        )
      `);

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

    const { data: sessions, error, count } = await query;

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

module.exports = {
  getAllSessions,
  getSessionById,
  updateSessionStatus,
  rescheduleSession,
  getSessionStats,
  searchSessions,
  createSession,
  deleteSession
};
