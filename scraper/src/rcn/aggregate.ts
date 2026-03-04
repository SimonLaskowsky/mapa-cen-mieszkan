import type { RcnTransactionWithDistrict, RcnAggregated } from './types.js';

function calculatePercentile(sortedArr: number[], percentile: number): number {
  if (sortedArr.length === 0) return 0;
  const index = (percentile / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (upper >= sortedArr.length) return sortedArr[sortedArr.length - 1];
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

export function aggregateByDistrictMonth(
  transactions: RcnTransactionWithDistrict[]
): RcnAggregated[] {
  // Group by city:district:YYYY-MM-01
  const groups = new Map<string, RcnTransactionWithDistrict[]>();

  for (const tx of transactions) {
    const d = tx.transactionDate;
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const key = `${tx.city}:${tx.district}:${month}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }

  const result: RcnAggregated[] = [];

  for (const [key, txs] of groups) {
    const [city, district, month] = key.split(':');
    const prices = txs.map(t => t.pricePerM2).sort((a, b) => a - b);

    const avgPriceM2 = prices.reduce((a, b) => a + b, 0) / prices.length;
    const medianPriceM2 = calculatePercentile(prices, 50);

    result.push({
      city,
      district,
      month,
      medianPriceM2: Math.round(medianPriceM2),
      avgPriceM2: Math.round(avgPriceM2),
      minPriceM2: Math.round(prices[0]),
      maxPriceM2: Math.round(prices[prices.length - 1]),
      p10PriceM2: Math.round(calculatePercentile(prices, 10)),
      p90PriceM2: Math.round(calculatePercentile(prices, 90)),
      transactionCount: txs.length,
      countPrimary: txs.filter(t => t.marketType === 'primary').length,
      countSecondary: txs.filter(t => t.marketType === 'secondary').length,
    });
  }

  return result;
}
