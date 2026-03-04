import { WFS_CITIES } from './config.js';
import { fetchAllTransactions } from './wfs-fetcher.js';
import { loadAllDistrictGeometries, assignDistricts } from './spatial-join.js';
import { aggregateByDistrictMonth } from './aggregate.js';
import { upsertRcnStats } from './upsert.js';

async function main() {
  console.log('🏛️  RCN Transaction Price Scraper\n');

  // The WFS server ignores teryt/city/bbox filters — it always returns the global Poland dataset.
  // Strategy: fetch once globally, then spatial-join to assign each transaction to city+district.
  const cities = WFS_CITIES.map(c => c.city);
  console.log(`Cities: ${cities.join(', ')}\n`);

  // 1. Fetch the full global Poland residential transaction dataset (single pass)
  const allTransactions = await fetchAllTransactions();

  if (allTransactions.length === 0) {
    console.log('⚠️  No transactions fetched, exiting');
    return;
  }

  // 2. Load district geometries for ALL configured cities at once
  const districts = await loadAllDistrictGeometries(cities);
  console.log(`\nLoaded ${districts.length} district geometries across ${cities.length} cities`);

  if (districts.length === 0) {
    console.log('⚠️  No district geometries found, exiting');
    return;
  }

  // 3. Spatial join: assign each transaction to its city+district via point-in-polygon
  console.log('Running spatial join...');
  const assigned = assignDistricts(allTransactions, districts);
  console.log(`Assigned ${assigned.length} / ${allTransactions.length} transactions to districts`);

  // Log per-city breakdown
  const cityCounts = new Map<string, number>();
  for (const tx of assigned) {
    cityCounts.set(tx.city, (cityCounts.get(tx.city) || 0) + 1);
  }
  for (const city of cities) {
    console.log(`  ${city}: ${cityCounts.get(city) || 0} transactions`);
  }

  if (assigned.length === 0) {
    console.log('⚠️  No transactions matched any district, exiting');
    return;
  }

  // 4. Aggregate by (city, district, month) and upsert to Supabase
  const aggregated = aggregateByDistrictMonth(assigned);
  console.log(`\nAggregated into ${aggregated.length} (city, district, month) buckets`);

  await upsertRcnStats(aggregated);
  console.log('\n✅ RCN scraper complete');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
