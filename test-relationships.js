const supabase = require('./config/supabase');

async function testDatabaseRelationships() {
  try {
    console.log('🔍 Testing Database Relationships...\n');

    // Test 1: Check if all tables exist
    console.log('1. Checking table existence...');
    const tables = ['users', 'clients', 'psychologists', 'sessions', 'packages', 'availability'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ ${table} table error:`, error.message);
        } else {
          console.log(`✅ ${table} table accessible`);
        }
      } catch (e) {
        console.log(`❌ ${table} table not accessible:`, e.message);
      }
    }

    // Test 2: Test foreign key relationships
    console.log('\n2. Testing foreign key relationships...');
    
    // Test sessions -> clients relationship
    try {
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          *,
          client:clients(*),
          psychologist:psychologists(*)
        `)
        .limit(1);
      
      if (sessionsError) {
        console.log('❌ Sessions join error:', sessionsError.message);
      } else {
        console.log('✅ Sessions table joins working correctly');
      }
    } catch (e) {
      console.log('❌ Sessions relationship test failed:', e.message);
    }

    // Test 3: Test packages -> psychologists relationship
    try {
      const { data: packages, error: packagesError } = await supabase
        .from('packages')
        .select(`
          *,
          psychologist:psychologists(*)
        `)
        .limit(1);
      
      if (packagesError) {
        console.log('❌ Packages join error:', packagesError.message);
      } else {
        console.log('✅ Packages table joins working correctly');
      }
    } catch (e) {
      console.log('❌ Packages relationship test failed:', e.message);
    }

    // Test 4: Test availability -> psychologists relationship
    try {
      const { data: availability, error: availabilityError } = await supabase
        .from('availability')
        .select(`
          *,
          psychologist:psychologists(*)
        `)
        .limit(1);
      
      if (availabilityError) {
        console.log('❌ Availability join error:', availabilityError.message);
      } else {
        console.log('✅ Availability table joins working correctly');
      }
    } catch (e) {
      console.log('❌ Availability relationship test failed:', e.message);
    }

    console.log('\n✅ Database relationship tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDatabaseRelationships().catch(console.error);
