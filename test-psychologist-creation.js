const supabase = require('./config/supabase');
const { hashPassword } = require('./utils/helpers');

async function createTestPsychologist() {
  try {
    console.log('🚀 Creating test psychologist...');
    
    const testPsychologist = {
      email: 'sam@example.com',
      password: 'password123',
      first_name: 'Sam',
      last_name: 'Johnson',
      phone: '+1234567890',
      ug_college: 'University of Psychology',
      pg_college: 'Graduate School of Mental Health',
      phd_college: 'Doctoral Institute of Psychology',
      area_of_expertise: ['Anxiety', 'Depression', 'Trauma'],
      description: 'Experienced psychologist specializing in anxiety and depression treatment.',
      experience_years: 8
    };

    // Check if psychologist already exists
    const { data: existingPsychologist } = await supabase
      .from('psychologists')
      .select('id')
      .eq('email', testPsychologist.email)
      .single();

    if (existingPsychologist) {
      console.log('✅ Psychologist already exists with email:', testPsychologist.email);
      return testPsychologist;
    }

    // Hash password
    const hashedPassword = await hashPassword(testPsychologist.password);

    // Create psychologist in psychologists table
    const { data: psychologist, error: psychologistError } = await supabase
      .from('psychologists')
      .insert([{
        email: testPsychologist.email,
        password_hash: hashedPassword,
        first_name: testPsychologist.first_name,
        last_name: testPsychologist.last_name,
        phone: testPsychologist.phone,
        ug_college: testPsychologist.ug_college,
        pg_college: testPsychologist.pg_college,
        phd_college: testPsychologist.phd_college,
        area_of_expertise: testPsychologist.area_of_expertise,
        description: testPsychologist.description,
        experience_years: testPsychologist.experience_years
      }])
      .select('*')
      .single();

    if (psychologistError) {
      console.error('❌ Failed to create psychologist:', psychologistError);
      throw psychologistError;
    }

    console.log('✅ Test psychologist created successfully!');
    console.log('📧 Email:', testPsychologist.email);
    console.log('🔑 Password:', testPsychologist.password);
    console.log('🆔 ID:', psychologist.id);
    
    return testPsychologist;

  } catch (error) {
    console.error('❌ Error creating test psychologist:', error);
    throw error;
  }
}

async function testPsychologistLogin() {
  try {
    console.log('\n🧪 Testing psychologist login...');
    
    const testPsychologist = {
      email: 'sam@example.com',
      password: 'password123'
    };

    // Test login endpoint
    const response = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPsychologist)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Login successful!');
      console.log('🎫 Token:', result.data.token.substring(0, 20) + '...');
      console.log('👤 User:', result.data.user);
      return result.data.token;
    } else {
      console.log('❌ Login failed:', result);
      return null;
    }

  } catch (error) {
    console.error('❌ Error testing login:', error);
    return null;
  }
}

async function testPsychologistDashboard(token) {
  if (!token) {
    console.log('❌ No token available for dashboard test');
    return;
  }

  try {
    console.log('\n🧪 Testing psychologist dashboard...');
    
    // Test profile endpoint
    const profileResponse = await fetch('http://localhost:5001/api/psychologists/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const profileResult = await profileResponse.json();
    
    if (profileResponse.ok) {
      console.log('✅ Profile endpoint working!');
      console.log('👤 Profile:', profileResult.data);
    } else {
      console.log('❌ Profile endpoint failed:', profileResult);
    }

    // Test sessions endpoint
    const sessionsResponse = await fetch('http://localhost:5001/api/psychologists/sessions', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const sessionsResult = await sessionsResponse.json();
    
    if (sessionsResponse.ok) {
      console.log('✅ Sessions endpoint working!');
      console.log('📅 Sessions:', sessionsResult.data);
    } else {
      console.log('❌ Sessions endpoint failed:', sessionsResult);
    }

  } catch (error) {
    console.error('❌ Error testing dashboard:', error);
  }
}

async function main() {
  try {
    console.log('🧪 Starting psychologist creation and testing...\n');
    
    // Create test psychologist
    const testPsychologist = await createTestPsychologist();
    
    // Test login
    const token = await testPsychologistLogin();
    
    // Test dashboard
    await testPsychologistDashboard(token);
    
    console.log('\n🎉 Test completed!');
    console.log('\n📋 Test Credentials:');
    console.log('📧 Email:', testPsychologist.email);
    console.log('🔑 Password:', testPsychologist.password);
    console.log('\n💡 You can now use these credentials to login to the psychologist dashboard!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
main().catch(console.error);
