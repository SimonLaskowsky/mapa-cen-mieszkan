import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Normalize district name for consistency
function normalizeDistrictName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

async function main() {
  console.log('🏙️  Seeding Katowice districts...\n');

  // Read GeoJSON
  const geojsonPath = path.join(process.cwd(), 'src/data/katowice-districts.json');
  const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

  const districts = geojson.features.map((feature: any) => {
    const name = feature.properties.name || feature.properties.nazwa;
    const normalizedName = normalizeDistrictName(name);

    return {
      city: 'katowice',
      district: normalizedName,
      geojson: feature.geometry,
      center_lat: feature.properties.center_lat,
      center_lng: feature.properties.center_lng,
    };
  });

  console.log(`Found ${districts.length} districts to insert:\n`);
  districts.forEach((d: any) => console.log(`  - ${d.district}`));

  // Insert into database
  const { data, error } = await supabase
    .from('districts')
    .upsert(districts, { onConflict: 'city,district' })
    .select();

  if (error) {
    console.error('\n❌ Error inserting districts:', error);
    process.exit(1);
  }

  console.log(`\n✅ Successfully inserted/updated ${data?.length || 0} districts`);
}

main().catch(console.error);
