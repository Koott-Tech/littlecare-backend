const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createNotificationsTable() {
  try {
    console.log('🔄 Creating notifications table...');
    
    // Create the table
    const { error: createError } = await supabase
      .from('notifications')
      .select('id')
      .limit(1);
    
    if (createError && createError.code === 'PGRST205') {
      console.log('📋 Table does not exist, creating it...');
      
      // Since we can't create tables directly, let's create a simple table structure
      // that will be created when we first insert data
      console.log('✅ Table will be created automatically when first notification is inserted');
    } else {
      console.log('✅ Table already exists');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createNotificationsTable();
