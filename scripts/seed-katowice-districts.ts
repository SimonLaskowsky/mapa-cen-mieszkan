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
// NOTE: ł (U+0142) has no NFD decomposition and must NOT be stripped —
// keep it so the name matches what the scraper's normalizeDistrict() produces.
function normalizeDistrictName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove combining diacritics (ę→e, ó→o, ą→a …)
    .replace(/\s+/g, '-');
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
      geojson: feature,
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

  // Refresh PostGIS geometry column from JSONB
  const { error: rpcError } = await supabase.rpc('refresh_district_geometries' as never);
  if (rpcError) {
    console.error('⚠️  Error refreshing geometries:', rpcError.message);
  } else {
    console.log('🗺️  PostGIS geometries refreshed');
  }
}

main().catch(console.error);
