import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // 1. Total listings count
  const { count: total } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true });

  console.log('\n📊 TOTAL LISTINGS:', total, '\n');

  // 2. Get all external_ids and check for duplicates
  const { data: allListings } = await supabase
    .from('listings')
    .select('external_id')
    .limit(5000);

  if (allListings) {
    const ids = allListings.map(l => l.external_id);
    const uniqueIds = new Set(ids);

    console.log('📋 Total rows:', ids.length);
    console.log('🔑 Unique external_ids:', uniqueIds.size);
    console.log('🔄 Duplicates:', ids.length - uniqueIds.size);

    if (ids.length === uniqueIds.size) {
      console.log('\n✅ NO DUPLICATES - Deduplication working correctly!\n');
    } else {
      console.log('\n❌ DUPLICATES FOUND!\n');

      // Find which ones are duplicated
      const counts: Record<string, number> = {};
      ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
      const dupes = Object.entries(counts).filter(([_, c]) => c > 1);
      console.log('Duplicated IDs:', dupes.slice(0, 5));
    }
  }

  // 3. Show sample external_ids
  const { data: samples } = await supabase
    .from('listings')
    .select('external_id, city, district, price, scraped_at')
    .limit(5);

  console.log('📝 Sample listings:');
  samples?.forEach(s => {
    console.log('  ', s.external_id, '|', s.city + '/' + s.district, '|', s.price, 'zł');
  });

  // 4. Count by city
  const { count: warsawCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('city', 'warszawa');

  const { count: katowiceCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('city', 'katowice');

  console.log('\n🏙️  By city:');
  console.log('   Warszawa:', warsawCount);
  console.log('   Katowice:', katowiceCount);
}

check().catch(console.error);
