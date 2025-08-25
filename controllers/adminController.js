const supabase = require('../config/supabase');
const { 
  successResponse, 
  errorResponse,
  hashPassword
} = require('../utils/helpers');

// Get all users
const getAllUsers = async (req, res) => {
  try {
    console.log('=== getAllUsers function called ===');
    console.log('Query params:', req.query);
    
    const { page = 1, limit = 10, role, search, sort = 'created_at', order = 'desc' } = req.query;

    // Test Supabase connection first
    try {
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (testError) {
        console.error('Supabase connection test failed:', testError);
        return res.status(500).json(
          errorResponse('Database connection failed')
        );
      }
      console.log('Supabase connection test successful');
    } catch (connectionError) {
      console.error('Supabase connection error:', connectionError);
      return res.status(500).json(
        errorResponse('Database connection failed')
      );
    }

    let query = supabase
      .from('users')
      .select(`
        id,
        email,
        role,
        profile_picture_url,
        created_at,
        updated_at
      `);

    // Filter by role if provided
    if (role) {
      query = query.eq('role', role);
    }

    // Apply sorting
    if (sort && order) {
      query = query.order(sort, { ascending: order === 'asc' });
    }

    // Add pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: users, error, count } = await query;

    if (error) {
      console.error('Get all users error:', error);
      return res.status(500).json(
        errorResponse('Failed to fetch users')
      );
    }

    // If fetching psychologists, get their profile information
    let enrichedUsers = users;
    if (role === 'psychologist') {
      const userIds = users.map(user => user.id);
      console.log('Fetching psychologist profiles for users:', userIds);
      
      // Only proceed if there are users to fetch profiles for
      if (userIds.length > 0) {
        try {
          const { data: psychologists, error: psychError } = await supabase
            .from('psychologists')
            .select('*')
            .in('user_id', userIds);

          if (psychError) {
            console.error('Error fetching psychologist profiles:', psychError);
            // Continue with basic user data if psychologist profiles fail
            enrichedUsers = users.map(user => ({
              ...user,
              first_name: '',
              last_name: '',
              name: '',
              phone: '',
              ug_college: '',
              pg_college: '',
              phd_college: '',
              description: '',
              experience_years: 0,
              area_of_expertise: [],
              availability: [],
              cover_image_url: null
            }));
          } else {
            console.log('Successfully fetched psychologist profiles:', psychologists?.length || 0);
            
            // Create a map of psychologist profiles by user_id
            const psychMap = {};
            psychologists.forEach(psych => {
              psychMap[psych.user_id] = psych;
            });

            // Enrich users with psychologist profile data
            enrichedUsers = users.map(user => {
              const psych = psychMap[user.id];
              return {
                ...user,
                first_name: psych?.first_name || '',
                last_name: psych?.last_name || '',
                name: psych ? `${psych.first_name} ${psych.last_name}`.trim() : '',
                phone: psych?.phone || '',
                ug_college: psych?.ug_college || '',
                pg_college: psych?.pg_college || '',
                phd_college: psych?.phd_college || '',
                description: psych?.description || '',
                experience_years: psych?.experience_years || 0,
                area_of_expertise: psych?.area_of_expertise || [],
                availability: psych?.availability || [],
                cover_image_url: psych?.cover_image_url || null
              };
            });
          }
        } catch (psychError) {
          console.error('Exception while fetching psychologist profiles:', psychError);
          // Continue with basic user data if there's an exception
          enrichedUsers = users.map(user => ({
            ...user,
            first_name: '',
            last_name: '',
            name: '',
            phone: '',
            ug_college: '',
            pg_college: '',
            phd_college: '',
            description: '',
            experience_years: 0,
            area_of_expertise: [],
            availability: [],
            cover_image_url: null
          }));
        }
      } else {
        console.log('No users with psychologist role found');
        // Set default values for users without psychologist profiles
        enrichedUsers = users.map(user => ({
          ...user,
          first_name: '',
          last_name: '',
          name: '',
          phone: '',
          ug_college: '',
          pg_college: '',
          phd_college: '',
          description: '',
          experience_years: 0,
          area_of_expertise: [],
          availability: [],
          cover_image_url: null
        }));
      }
    }

    // Filter by search if provided
    let filteredUsers = enrichedUsers;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = enrichedUsers.filter(user => 
        user.email.toLowerCase().includes(searchLower) ||
        (user.name && user.name.toLowerCase().includes(searchLower))
      );
    }

    res.json(
      successResponse({
        users: filteredUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || filteredUsers.length
        }
      })
    );

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching users')
    );
  }
};

// Get user details with profile
const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json(
        errorResponse('User not found')
      );
    }

    // Get role-specific profile
    let profile = null;
    if (user.role === 'client') {
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', userId)
        .single();
      profile = client;
    } else if (user.role === 'psychologist') {
      const { data: psychologist } = await supabase
        .from('psychologists')
        .select('*')
        .eq('user_id', userId)
        .single();
      profile = psychologist;
    }

    res.json(
      successResponse({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile_picture_url: user.profile_picture_url,
          created_at: user.created_at,
          updated_at: user.updated_at,
          profile
        }
      })
    );

  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching user details')
    );
  }
};

// Update user role
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { new_role } = req.body;

    if (!new_role || !['client', 'psychologist', 'admin', 'superadmin'].includes(new_role)) {
      return res.status(400).json(
        errorResponse('Valid new role is required')
      );
    }

    // Check if user exists
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (!user) {
      return res.status(404).json(
        errorResponse('User not found')
      );
    }

    // Prevent changing superadmin role
    if (user.role === 'superadmin') {
      return res.status(403).json(
        errorResponse('Cannot change superadmin role')
      );
    }

    // Update user role
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        role: new_role,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, email, role, updated_at')
      .single();

    if (error) {
      console.error('Update user role error:', error);
      return res.status(500).json(
        errorResponse('Failed to update user role')
      );
    }

    res.json(
      successResponse(updatedUser, 'User role updated successfully')
    );

  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json(
      errorResponse('Internal server error while updating user role')
    );
  }
};

// Deactivate user
const deactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    // Check if user exists
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (!user) {
      return res.status(404).json(
        errorResponse('User not found')
      );
    }

    // Prevent deactivating superadmin
    if (user.role === 'superadmin') {
      return res.status(403).json(
        errorResponse('Cannot deactivate superadmin')
      );
    }

    // For now, we'll just update the user to indicate deactivation
    // In a real system, you might want to add a status field or move to archive table
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        updated_at: new Date().toISOString()
        // Add deactivation logic here
      })
      .eq('id', userId)
      .select('id, email, role, updated_at')
      .single();

    if (error) {
      console.error('Deactivate user error:', error);
      return res.status(500).json(
        errorResponse('Failed to deactivate user')
      );
    }

    res.json(
      successResponse(updatedUser, 'User deactivated successfully')
    );

  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json(
      errorResponse('Internal server error while deactivating user')
    );
  }
};

// Get platform statistics
const getPlatformStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    // Get user counts by role
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('role, created_at');

    if (usersError) {
      console.error('Get users error:', usersError);
      return res.status(500).json(
        errorResponse('Failed to fetch user statistics')
      );
    }

    // Get session statistics
    let sessionQuery = supabase
      .from('sessions')
      .select('status, scheduled_date, price, created_at');

    if (start_date && end_date) {
      sessionQuery = sessionQuery.gte('scheduled_date', start_date).lte('scheduled_date', end_date);
    }

    const { data: sessions, error: sessionsError } = await sessionQuery;

    if (sessionsError) {
      console.error('Get sessions error:', sessionsError);
      return res.status(500).json(
        errorResponse('Failed to fetch session statistics')
      );
    }

    // Calculate statistics
    const stats = {
      users: {
        total: users.length,
        by_role: {}
      },
      sessions: {
        total: sessions.length,
        total_revenue: sessions.reduce((sum, session) => sum + parseFloat(session.price || 0), 0),
        by_status: {}
      },
      growth: {
        new_users_this_month: 0,
        new_sessions_this_month: 0
      }
    };

    // User statistics
    users.forEach(user => {
      stats.users.by_role[user.role] = (stats.users.by_role[user.role] || 0) + 1;
      
      // Growth statistics
      const userDate = new Date(user.created_at);
      const now = new Date();
      if (userDate.getMonth() === now.getMonth() && userDate.getFullYear() === now.getFullYear()) {
        stats.growth.new_users_this_month++;
      }
    });

    // Session statistics
    sessions.forEach(session => {
      stats.sessions.by_status[session.status] = (stats.sessions.by_status[session.status] || 0) + 1;
      
      // Growth statistics
      const sessionDate = new Date(session.created_at);
      const now = new Date();
      if (sessionDate.getMonth() === now.getMonth() && sessionDate.getFullYear() === now.getFullYear()) {
        stats.growth.new_sessions_this_month++;
      }
    });

    res.json(
      successResponse(stats)
    );

  } catch (error) {
    console.error('Get platform stats error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching platform statistics')
    );
  }
};

// Search users
const searchUsers = async (req, res) => {
  try {
    const { 
      query: searchQuery, 
      page = 1, 
      limit = 10,
      role
    } = req.query;

    if (!searchQuery) {
      return res.status(400).json(
        errorResponse('Search query is required')
      );
    }

    let supabaseQuery = supabase
      .from('users')
      .select(`
        id,
        email,
        role,
        profile_picture_url,
        created_at,
        updated_at
      `);

    // Filter by role if provided
    if (role) {
      supabaseQuery = supabaseQuery.eq('role', role);
    }

    const { data: users, error } = await supabaseQuery;

    if (error) {
      console.error('Search users error:', error);
      return res.status(500).json(
        errorResponse('Failed to search users')
      );
    }

    // Filter by search query
    const query = searchQuery.toLowerCase();
    const filteredUsers = users.filter(user => 
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    );

    // Add pagination
    const offset = (page - 1) * limit;
    const paginatedUsers = filteredUsers.slice(offset, offset + limit);

    res.json(
      successResponse({
        users: paginatedUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredUsers.length
        }
      })
    );

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json(
      errorResponse('Internal server error while searching users')
    );
  }
};

// Create psychologist (admin only)
const createPsychologist = async (req, res) => {
  try {
    console.log('=== createPsychologist function called ===');
    console.log('Request body:', req.body);
    const { email, password, first_name, last_name, ug_college, pg_college, phd_college, area_of_expertise, description, experience_years } = req.body;

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json(
        errorResponse('User with this email already exists')
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{
        email,
        password_hash: hashedPassword,
        role: 'psychologist'
      }])
      .select('id, email, role, created_at')
      .single();

    if (userError) {
      console.error('User creation error:', userError);
      return res.status(500).json(
        errorResponse('Failed to create user account')
      );
    }

    // Create psychologist profile
    const { data: psychologist, error: psychologistError } = await supabase
      .from('psychologists')
      .insert([{
        user_id: user.id,
        first_name,
        last_name,
        ug_college,
        pg_college,
        phd_college,
        area_of_expertise,
        description,
        experience_years: experience_years || 0
      }])
      .select('*')
      .single();

    if (psychologistError) {
      console.error('Psychologist profile creation error:', psychologistError);
      // Delete user if profile creation fails
      await supabase.from('users').delete().eq('id', user.id);
      return res.status(500).json(
        errorResponse('Failed to create psychologist profile')
      );
    }

    res.status(201).json(
      successResponse({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: psychologist
        }
      }, 'Psychologist created successfully')
    );

  } catch (error) {
    console.error('Create psychologist error:', error);
    res.status(500).json(
      errorResponse('Internal server error while creating psychologist')
    );
  }
};

// Update psychologist (admin only)
const updatePsychologist = async (req, res) => {
  try {
    const { psychologistId } = req.params;
    const updateData = req.body;

    // Get psychologist profile
    const { data: psychologist, error: psychologistError } = await supabase
      .from('psychologists')
      .select('*')
      .eq('id', psychologistId)
      .single();

    if (psychologistError || !psychologist) {
      return res.status(404).json(
        errorResponse('Psychologist not found')
      );
    }

    // Update psychologist profile
    const { data: updatedPsychologist, error: updateError } = await supabase
      .from('psychologists')
      .update(updateData)
      .eq('id', psychologistId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Update psychologist error:', updateError);
      return res.status(500).json(
        errorResponse('Failed to update psychologist profile')
      );
    }

    res.json(
      successResponse(updatedPsychologist, 'Psychologist updated successfully')
    );

  } catch (error) {
    console.error('Update psychologist error:', error);
    res.status(500).json(
      errorResponse('Internal server error while updating psychologist')
    );
  }
};

// Delete psychologist (admin only)
const deletePsychologist = async (req, res) => {
  try {
    const { psychologistId } = req.params;

    // Get psychologist profile
    const { data: psychologist, error: psychologistError } = await supabase
      .from('psychologists')
      .select('user_id')
      .eq('id', psychologistId)
      .single();

    if (psychologistError || !psychologist) {
      return res.status(404).json(
        errorResponse('Psychologist not found')
      );
    }

    // Delete psychologist profile first
    const { error: deleteProfileError } = await supabase
      .from('psychologists')
      .delete()
      .eq('id', psychologistId);

    if (deleteProfileError) {
      console.error('Delete psychologist profile error:', deleteProfileError);
      return res.status(500).json(
        errorResponse('Failed to delete psychologist profile')
      );
    }

    // Delete user account
    const { error: deleteUserError } = await supabase
      .from('users')
      .delete()
      .eq('id', psychologist.user_id);

    if (deleteUserError) {
      console.error('Delete user error:', deleteUserError);
      return res.status(500).json(
        errorResponse('Failed to delete user account')
      );
    }

    res.json(
      successResponse(null, 'Psychologist deleted successfully')
    );

  } catch (error) {
    console.error('Delete psychologist error:', error);
    res.status(500).json(
      errorResponse('Internal server error while deleting psychologist')
    );
  }
};

// Create user (admin only)
const createUser = async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone_number, child_name, child_age } = req.body;

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json(
        errorResponse('User with this email already exists')
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{
        email,
        password_hash: hashedPassword,
        role: 'client'
      }])
      .select('id, email, role, created_at')
      .single();

    if (userError) {
      console.error('User creation error:', userError);
      return res.status(500).json(
        errorResponse('Failed to create user account')
      );
    }

    // Create client profile
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert([{
        user_id: user.id,
        first_name,
        last_name,
        phone_number,
        child_name,
        child_age
      }])
      .select('*')
      .single();

    if (clientError) {
      console.error('Client profile creation error:', clientError);
      // Delete user if profile creation fails
      await supabase.from('users').delete().eq('id', user.id);
      return res.status(500).json(
        errorResponse('Failed to create client profile')
      );
    }

    res.status(201).json(
      successResponse({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: client
        }
      }, 'Client created successfully')
    );

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json(
      errorResponse('Internal server error while creating user')
    );
  }
};

// Update user (admin only)
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json(
        errorResponse('User not found')
      );
    }

    // Update user profile based on role
    if (user.role === 'client') {
      const { data: updatedClient, error: updateError } = await supabase
        .from('clients')
        .update(updateData)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (updateError) {
        console.error('Update client error:', updateError);
        return res.status(500).json(
          errorResponse('Failed to update client profile')
        );
      }

      res.json(
        successResponse(updatedClient, 'Client updated successfully')
      );
    } else {
      res.status(400).json(
        errorResponse('Can only update client profiles')
      );
    }

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json(
      errorResponse('Internal server error while updating user')
    );
  }
};

// Delete user (admin only)
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json(
        errorResponse('User not found')
      );
    }

    // Delete profile first
    if (user.role === 'client') {
      const { error: deleteProfileError } = await supabase
        .from('clients')
        .delete()
        .eq('user_id', userId);

      if (deleteProfileError) {
        console.error('Delete client profile error:', deleteProfileError);
        return res.status(500).json(
          errorResponse('Failed to delete client profile')
        );
      }
    }

    // Delete user account
    const { error: deleteUserError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteUserError) {
      console.error('Delete user error:', deleteUserError);
      return res.status(500).json(
        errorResponse('Failed to delete user account')
      );
    }

    res.json(
      successResponse(null, 'User deleted successfully')
    );

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json(
      errorResponse('Internal server error while deleting user')
    );
  }
};

module.exports = {
  getAllUsers,
  getUserDetails,
  updateUserRole,
  deactivateUser,
  getPlatformStats,
  searchUsers,
  createPsychologist,
  updatePsychologist,
  deletePsychologist,
  createUser,
  updateUser,
  deleteUser
};
