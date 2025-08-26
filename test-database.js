const supabase = require('./config/supabase');

async function testDatabase() {
  try {
    console.log('🔍 Testing database connection and structure...\n');

    // Test 1: Check if clients table exists and get its structure
    console.log('1. Checking clients table structure...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);

    if (tableError) {
      console.log('❌ Error accessing clients table:', tableError);
      
      // Try to get table info from information_schema
      const { data: schemaInfo, error: schemaError } = await supabase
        .rpc('get_table_info', { table_name: 'clients' });
      
      if (schemaError) {
        console.log('❌ Could not get table info:', schemaError);
      } else {
        console.log('✅ Table info:', schemaInfo);
      }
    } else {
      console.log('✅ Clients table accessible');
      console.log('📊 Sample data structure:', tableInfo);
    }

    // Test 2: Check users table
    console.log('\n2. Checking users table...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (usersError) {
      console.log('❌ Error accessing users table:', usersError);
    } else {
      console.log('✅ Users table accessible');
      console.log('📊 Sample data structure:', users);
    }

    // Test 3: Try to insert a test user
    console.log('\n3. Testing user creation...');
    const testUser = {
      email: 'testdb@example.com',
      password_hash: 'test_hash',
      role: 'client'
    };

    const { data: newUser, error: userInsertError } = await supabase
      .from('users')
      .insert([testUser])
      .select('id, email, role')
      .single();

    if (userInsertError) {
      console.log('❌ Error creating test user:', userInsertError);
    } else {
      console.log('✅ Test user created:', newUser);

      // Test 4: Try to insert a test client profile
      console.log('\n4. Testing client profile creation...');
      const testClient = {
        user_id: newUser.id,
        first_name: 'Test',
        last_name: 'User',
        phone_number: '1234567890',
        child_name: 'Test Child',
        child_age: 5
      };

      const { data: newClient, error: clientInsertError } = await supabase
        .from('clients')
        .insert([testClient])
        .select('*')
        .single();

      if (clientInsertError) {
        console.log('❌ Error creating test client:', clientInsertError);
      } else {
        console.log('✅ Test client created:', newClient);

        // Clean up test data
        console.log('\n5. Cleaning up test data...');
        await supabase.from('clients').delete().eq('id', newClient.id);
        await supabase.from('users').delete().eq('id', newUser.id);
        console.log('✅ Test data cleaned up');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDatabase().catch(console.error);
