import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const POLAND_BOUNDS = { minLat: 49, maxLat: 55, minLng: 14, maxLng: 25 };
const DELAY_MS = 350;

interface Listing {
  id: string;
  url: string;
  source: string;
  city: string;
  district: string;
}

async function fetchCoordsFromListingPage(url: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pl-PL,pl;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    const match = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return null;

    const data: unknown[] = JSON.parse(match[1]);

    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      if (
        val !== null &&
        typeof val === 'object' &&
        !Array.isArray(val) &&
        'center' in val &&
        'zoom' in val
      ) {
        const centerIdx = (val as { center: number }).center;
        const centerObj = data[centerIdx];
        if (
          centerObj !== null &&
          typeof centerObj === 'object' &&
          !Array.isArray(centerObj) &&
          'latitude' in centerObj &&
          'longitude' in centerObj
        ) {
          const latIdx = (centerObj as { latitude: number; longitude: number }).latitude;
          const lngIdx = (centerObj as { latitude: number; longitude: number }).longitude;
          const lat = data[latIdx];
          const lng = data[lngIdx];
          if (
            typeof lat === 'number' &&
            typeof lng === 'number' &&
            lat > POLAND_BOUNDS.minLat && lat < POLAND_BOUNDS.maxLat &&
            lng > POLAND_BOUNDS.minLng && lng < POLAND_BOUNDS.maxLng
          ) {
            return { lat, lng };
          }
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('\n📍 BACKFILL COORDINATES\n');

  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, url, source, city, district')
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

  const mins = Math.ceil(listings.length * DELAY_MS / 60000);
  console.log(`Found ${listings.length} listings without coordinates (~${mins} min)\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i] as Listing;
    const progress = `[${i + 1}/${listings.length}]`;

    process.stdout.write(`${progress} ${listing.city}/${listing.district}...`);

    const coords = await fetchCoordsFromListingPage(listing.url);

    if (coords) {
      const { error: updateError } = await supabase
        .from('listings')
        .update({ lat: coords.lat, lng: coords.lng })
        .eq('id', listing.id);

      if (updateError) {
        console.log(` ❌ DB error`);
        failed++;
      } else {
        console.log(` ✅ ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
        success++;
      }
    } else {
      console.log(` ❌ not found`);
      failed++;
    }

    if (i < listings.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Success: ${success}  ❌ Failed: ${failed}  📍 Total: ${listings.length}`);
}

main().catch(console.error);
