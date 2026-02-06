import { supabase } from './db.js';

interface ListingRow {
  city: string;
  district: string;
  price: number;
  price_per_m2: number;
  size_m2: number;
  rooms: number | null;
  offer_type: string;
}

interface StatsRow {
  city: string;
  district: string;
  offer_type: string;
  date: string;
  avg_price: number;
  avg_price_m2: number;
  median_price_m2: number;
  min_price_m2: number;
  max_price_m2: number;
  p10_price_m2: number;
  p90_price_m2: number;
  stddev_price_m2: number;
  listing_count: number;
  new_listings: number;
  avg_size_m2: number;
  count_1room: number;
  count_2room: number;
  count_3room: number;
  count_4plus: number;
}

function calculatePercentile(sortedArr: number[], percentile: number): number {
  const index = (percentile / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sortedArr.length) return sortedArr[sortedArr.length - 1];
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

function calculateStdDev(arr: number[], mean: number): number {
  if (arr.length < 2) return 0;
  const squareDiffs = arr.map((value) => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(avgSquareDiff);
}

async function aggregateDistrict(
  city: string,
  district: string,
  offerType: string,
  date: string
): Promise<StatsRow | null> {
  // Fetch all listings for this district from the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: listings, error } = await supabase
    .from('listings')
    .select('price, price_per_m2, size_m2, rooms, offer_type')
    .eq('city', city)
    .eq('district', district)
    .eq('offer_type', offerType)
    .gte('scraped_at', thirtyDaysAgo.toISOString())
    .returns<ListingRow[]>();

  if (error) {
    console.error(`Error fetching listings for ${city}/${district}:`, error);
    return null;
  }

  if (!listings || listings.length === 0) {
    return null;
  }

  // Calculate statistics
  const pricesPerM2 = listings
    .map((l) => l.price_per_m2)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b);

  const totalPrices = listings
    .map((l) => l.price)
    .filter((p): p is number => p !== null);

  const sizes = listings
    .map((l) => l.size_m2)
    .filter((s): s is number => s !== null);

  if (pricesPerM2.length === 0) return null;

  const avgPricePerM2 = pricesPerM2.reduce((a, b) => a + b, 0) / pricesPerM2.length;
  const avgTotalPrice = totalPrices.length > 0 ? totalPrices.reduce((a, b) => a + b, 0) / totalPrices.length : 0;
  const medianPrice = calculatePercentile(pricesPerM2, 50);
  const avgSize = sizes.length > 0 ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0;

  // Count new listings (scraped today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count: newListings } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('city', city)
    .eq('district', district)
    .eq('offer_type', offerType)
    .gte('scraped_at', today.toISOString());

  // Room distribution
  const roomCounts = { 1: 0, 2: 0, 3: 0, '4+': 0 };
  for (const listing of listings) {
    if (listing.rooms === 1) roomCounts[1]++;
    else if (listing.rooms === 2) roomCounts[2]++;
    else if (listing.rooms === 3) roomCounts[3]++;
    else if (listing.rooms && listing.rooms >= 4) roomCounts['4+']++;
  }

  return {
    city,
    district,
    offer_type: offerType,
    date,
    avg_price: Math.round(avgTotalPrice),
    avg_price_m2: Math.round(avgPricePerM2),
    median_price_m2: Math.round(medianPrice),
    min_price_m2: Math.round(pricesPerM2[0]),
    max_price_m2: Math.round(pricesPerM2[pricesPerM2.length - 1]),
    p10_price_m2: Math.round(calculatePercentile(pricesPerM2, 10)),
    p90_price_m2: Math.round(calculatePercentile(pricesPerM2, 90)),
    stddev_price_m2: Math.round(calculateStdDev(pricesPerM2, avgPricePerM2)),
    listing_count: listings.length,
    new_listings: newListings || 0,
    avg_size_m2: Math.round(avgSize * 10) / 10,
    count_1room: roomCounts[1],
    count_2room: roomCounts[2],
    count_3room: roomCounts[3],
    count_4plus: roomCounts['4+'],
  };
}

async function main() {
  console.log('📊 Aggregating listing data into district stats...\n');

  const today = new Date().toISOString().split('T')[0];
  console.log(`📅 Date: ${today}\n`);

  // Get all districts
  const { data: districts, error: districtError } = await supabase
    .from('districts')
    .select('city, district');

  if (districtError || !districts) {
    console.error('Failed to fetch districts:', districtError);
    process.exit(1);
  }

  console.log(`📍 Processing ${districts.length} districts x 2 offer types...\n`);

  let aggregated = 0;
  let skipped = 0;

  const offerTypes = ['sale', 'rent'];

  for (const { city, district } of districts) {
    for (const offerType of offerTypes) {
      const stats = await aggregateDistrict(city, district, offerType, today);

      if (stats) {
        const { error } = await supabase.from('district_stats').upsert(stats, {
          onConflict: 'city,district,date,offer_type',
        });

        if (error) {
          console.error(`  ❌ ${city}/${district} (${offerType}): ${error.message}`);
        } else {
          const displayPrice = offerType === 'sale'
            ? `${stats.avg_price_m2} zł/m²`
            : `${stats.avg_price} zł/month`;
          console.log(
            `  ✅ ${city}/${district} (${offerType}): ${stats.listing_count} listings, avg ${displayPrice}`
          );
          aggregated++;
        }
      } else {
        skipped++;
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Aggregated: ${aggregated} districts`);
  console.log(`  Skipped (no data): ${skipped} districts`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
