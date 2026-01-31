import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  console.log('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓ set' : '✗ missing');
  console.log('  SUPABASE_SERVICE_KEY:', supabaseKey ? '✓ set' : '✗ missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('🔌 Testing Supabase connection...\n');

  // Test basic connection
  const { error: connError } = await supabase.from('districts').select('count').limit(1);

  if (connError && connError.code === '42P01') {
    console.log('⚠️  Connection works, but tables not found.');
    console.log('   Please run the migration SQL in Supabase SQL Editor:');
    console.log('   → supabase/migrations/001_initial_schema.sql\n');
    return;
  }

  if (connError) {
    console.error('❌ Connection error:', connError.message);
    return;
  }

  console.log('✅ Connection successful!\n');

  // Check each table
  const tables = ['districts', 'listings', 'district_stats', 'alerts'];

  console.log('📋 Checking tables:');
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`   ${table}: ❌ ${error.message}`);
    } else {
      console.log(`   ${table}: ✅ exists (${count} rows)`);
    }
  }

  // Check views
  console.log('\n📊 Checking views:');
  const views = ['latest_district_stats', 'district_price_changes'];

  for (const view of views) {
    const { count, error } = await supabase
      .from(view)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`   ${view}: ❌ ${error.message}`);
    } else {
      console.log(`   ${view}: ✅ exists (${count} rows)`);
    }
  }

  console.log('\n✨ Database setup verified!');
}

testConnection().catch(console.error);
