const supabase = require('../config/supabase');
const { 
  generateToken, 
  hashPassword, 
  comparePassword,
  successResponse,
  errorResponse
} = require('../utils/helpers');

// Client registration (only clients can register themselves)
const registerClient = async (req, res) => {
  try {
    const { email, password } = req.body;

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

    // Create user with client role (minimal account)
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{
        email,
        password_hash: hashedPassword,
        role: 'client' // Always set role to client for self-registration
      }])
      .select('id, email, role, created_at')
      .single();

    if (userError) {
      console.error('User creation error:', userError);
      return res.status(500).json(
        errorResponse('Failed to create user account')
      );
    }

    // Create minimal client profile (empty for now)
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert([{
        user_id: user.id,
        first_name: 'Pending', // Default value instead of null
        last_name: 'Pending',  // Default value instead of null
        phone_number: 'Pending', // Default value instead of null
        child_name: 'Pending',   // Default value instead of null
        child_age: 0             // Default value instead of null
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

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    res.status(201).json(
      successResponse({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: client
        },
        token
      }, 'Client account created successfully with default profile values. Please complete your profile information.')
    );

  } catch (error) {
    console.error('Client registration error:', error);
    res.status(500).json(
      errorResponse('Internal server error during registration')
    );
  }
};

// User login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // First check if it's a psychologist
    const { data: psychologist, error: psychologistError } = await supabase
      .from('psychologists')
      .select('*')
      .eq('email', email)
      .single();

    if (psychologist && !psychologistError) {
      // Verify password for psychologist
      const isValidPassword = await comparePassword(password, psychologist.password_hash);
      if (!isValidPassword) {
        return res.status(401).json(
          errorResponse('Invalid email or password')
        );
      }

      // Generate JWT token for psychologist
      const token = generateToken(psychologist.id, 'psychologist');

      res.json(
        successResponse({
          user: {
            id: psychologist.id,
            email: psychologist.email,
            role: 'psychologist',
            profile_picture_url: null,
            profile: psychologist
          },
          token
        }, 'Login successful')
      );
      return;
    }

    // If not a psychologist, check users table for clients/admins
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(401).json(
        errorResponse('Invalid email or password')
      );
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json(
        errorResponse('Invalid email or password')
      );
    }

    // Get role-specific profile
    let profile = null;
    if (user.role === 'client') {
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .single();
      profile = client;
    }

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    res.json(
      successResponse({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile_picture_url: user.profile_picture_url,
          profile
        },
        token
      }, 'Login successful')
    );

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(
      errorResponse('Internal server error during login')
    );
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get user with profile based on role
    let profile = null;
    
    if (userRole === 'client') {
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', userId)
        .single();
      profile = client;
    } else if (userRole === 'psychologist') {
      // For psychologists, the profile is the user data itself
      const { data: psychologist } = await supabase
        .from('psychologists')
        .select('*')
        .eq('id', userId)
        .single();
      profile = psychologist;
    }

    res.json(
      successResponse({
        user: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
          profile_picture_url: req.user.profile_picture_url || null,
          profile
        }
      })
    );

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching profile')
    );
  }
};

// Update profile picture
const updateProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;
    const { profile_picture_url } = req.body;

    if (!profile_picture_url) {
      return res.status(400).json(
        errorResponse('Profile picture URL is required')
      );
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({ 
        profile_picture_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('profile_picture_url')
      .single();

    if (error) {
      console.error('Profile picture update error:', error);
      return res.status(500).json(
        errorResponse('Failed to update profile picture')
      );
    }

    res.json(
      successResponse({
        profile_picture_url: user.profile_picture_url
      }, 'Profile picture updated successfully')
    );

  } catch (error) {
    console.error('Profile picture update error:', error);
    res.status(500).json(
      errorResponse('Internal server error while updating profile picture')
    );
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json(
        errorResponse('Current password and new password are required')
      );
    }

    if (newPassword.length < 6) {
      return res.status(400).json(
        errorResponse('New password must be at least 6 characters long')
      );
    }

    // Get current user to verify current password
    const { data: user } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json(
        errorResponse('Current password is incorrect')
      );
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update password
    const { error } = await supabase
      .from('users')
      .update({ 
        password_hash: hashedNewPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Password change error:', error);
      return res.status(500).json(
        errorResponse('Failed to change password')
      );
    }

    res.json(
      successResponse(null, 'Password changed successfully')
    );

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json(
      errorResponse('Internal server error while changing password')
    );
  }
};

// Logout (client-side token removal)
const logout = async (req, res) => {
  try {
    // In a stateless JWT system, logout is handled client-side
    // You could implement a blacklist here if needed
    res.json(
      successResponse(null, 'Logged out successfully')
    );
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json(
      errorResponse('Internal server error during logout')
    );
  }
};

// Get registration information
const getRegistrationInfo = async (req, res) => {
  try {
    const info = {
      message: 'Registration Information',
      policies: {
        clients: {
          canRegister: true,
          description: 'Clients can create accounts by providing email, password, and profile information.',
          requiredFields: ['email', 'password', 'first_name', 'last_name', 'phone_number', 'child_name', 'child_age'],
          endpoint: '/api/auth/register/client'
        },
        psychologists: {
          canRegister: false,
          description: 'Psychologist accounts are created by administrators only. Please contact support for access.',
          note: 'If you are a qualified psychologist, please contact the platform administrators.'
        },
        admins: {
          canRegister: false,
          description: 'Admin accounts are created by superadmins only.',
          note: 'Administrative access is granted by platform superadmins.'
        },
        superadmins: {
          canRegister: false,
          description: 'Superadmin accounts are created during system setup only.',
          note: 'Superadmin access is restricted to system administrators.'
        }
      },
      generalInfo: {
        loginEndpoint: '/api/auth/login',
        supportedRoles: ['client', 'psychologist', 'admin', 'superadmin'],
        note: 'All user types can log in once their accounts are created.'
      }
    };

    res.json(
      successResponse(info)
    );

  } catch (error) {
    console.error('Get registration info error:', error);
    res.status(500).json(
      errorResponse('Internal server error while fetching registration information')
    );
  }
};

module.exports = {
  registerClient,
  login,
  getProfile,
  updateProfilePicture,
  changePassword,
  logout,
  getRegistrationInfo
};
