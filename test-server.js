require('dotenv').config();
const supabase = require('./config/supabase');

// Test Supabase connection
async function testConnection() {
  try {
    console.log('🔌 Testing Supabase connection...');
    
    // Test a simple query
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connection successful!');
    console.log('📊 Database is accessible');
    return true;
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
}

// Test environment variables
function testEnvironment() {
  console.log('\n🔧 Testing environment variables...');
  
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'JWT_SECRET'
  ];
  
  let allGood = true;
  
  required.forEach(varName => {
    if (process.env[varName]) {
      console.log(`✅ ${varName}: Set`);
    } else {
      console.log(`❌ ${varName}: Missing`);
      allGood = false;
    }
  });
  
  if (allGood) {
    console.log('✅ All required environment variables are set');
  } else {
    console.log('❌ Some environment variables are missing');
    console.log('📝 Please check your .env file');
  }
  
  return allGood;
}

// Main test function
async function runTests() {
  console.log('🧪 Running backend tests...\n');
  
  const envOk = testEnvironment();
  
  if (envOk) {
    await testConnection();
  }
  
  console.log('\n📋 Test Summary:');
  console.log(`Environment: ${envOk ? '✅ OK' : '❌ Issues'}`);
  
  if (envOk) {
    console.log('\n🚀 Backend is ready to start!');
    console.log('Run: npm run dev');
  } else {
    console.log('\n⚠️  Please fix environment issues before starting');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { testConnection, testEnvironment };
