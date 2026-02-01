import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Rate limit: 1 request per second for Nominatim
const DELAY_MS = 1100;

interface Listing {
  id: string;
  address: string | null;
  district: string;
  city: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocodeAddress(address: string, district: string, city: string): Promise<{ lat: number; lng: number } | null> {
  // Build search query - try with full address first, fallback to district
  const queries = [
    `${address}, ${district}, ${city}, Poland`,
    `${district}, ${city}, Poland`,
  ];

  for (const query of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MapaCenMieszkan/1.0 (geocoding listings)',
        },
      });

      if (!response.ok) {
        console.log('   ⚠️  Nominatim error:', response.status);
        continue;
      }

      const data: NominatimResult[] = await response.json();

      if (data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
    } catch (err) {
      console.log('   ⚠️  Fetch error:', err);
    }
  }

  return null;
}

async function main() {
  console.log('\n🌍 GEOCODING LISTINGS\n');
  console.log('Fetching listings without coordinates...\n');

  // Fetch listings without lat/lng
  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, address, district, city')
    .or('lat.is.null,lng.is.null')
    .limit(2000);

  if (error) {
    console.error('❌ Error fetching listings:', error);
    process.exit(1);
  }

  if (!listings || listings.length === 0) {
    console.log('✅ All listings already have coordinates!');
    return;
  }

  console.log(`📍 Found ${listings.length} listings to geocode`);
  console.log(`⏱️  Estimated time: ${Math.ceil(listings.length * DELAY_MS / 60000)} minutes\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i] as Listing;
    const progress = `[${i + 1}/${listings.length}]`;

    // Skip if no address and no district
    if (!listing.address && !listing.district) {
      console.log(`${progress} ⏭️  Skipping - no address data`);
      skipped++;
      continue;
    }

    const searchAddress = listing.address || listing.district;
    process.stdout.write(`${progress} 🔍 ${listing.city}/${listing.district}: ${searchAddress?.substring(0, 30)}...`);

    const coords = await geocodeAddress(
      listing.address || '',
      listing.district,
      listing.city
    );

    if (coords) {
      // Update database
      const { error: updateError } = await supabase
        .from('listings')
        .update({ lat: coords.lat, lng: coords.lng })
        .eq('id', listing.id);

      if (updateError) {
        console.log(` ❌ DB error`);
        failed++;
      } else {
        console.log(` ✅ ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
        success++;
      }
    } else {
      console.log(` ❌ Not found`);
      failed++;
    }

    // Rate limit
    if (i < listings.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   📍 Total: ${listings.length}`);
}

main().catch(console.error);
