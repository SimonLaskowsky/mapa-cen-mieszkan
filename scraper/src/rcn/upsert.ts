import { supabase } from '../db.js';
import type { RcnAggregated } from './types.js';

const BATCH_SIZE = 100;

export async function upsertRcnStats(stats: RcnAggregated[]): Promise<void> {
  if (stats.length === 0) return;

  const rows = stats.map(s => ({
    city: s.city,
    district: s.district,
    month: s.month,
    median_price_m2: s.medianPriceM2,
    avg_price_m2: s.avgPriceM2,
    min_price_m2: s.minPriceM2,
    max_price_m2: s.maxPriceM2,
    p10_price_m2: s.p10PriceM2,
    p90_price_m2: s.p90PriceM2,
    transaction_count: s.transactionCount,
    count_primary: s.countPrimary,
    count_secondary: s.countSecondary,
    source: 'wfs',
  }));

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('rcn_district_stats')
      .upsert(batch, { onConflict: 'city,district,month' });

    if (error) {
      console.error(`  Upsert error (batch ${i / BATCH_SIZE + 1}):`, error.message);
    } else {
      console.log(`  Upserted batch ${i / BATCH_SIZE + 1}: ${batch.length} rows`);
    }
  }
}
