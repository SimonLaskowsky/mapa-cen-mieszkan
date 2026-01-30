// Warsaw districts data with real GeoJSON boundaries and price statistics

import rawGeoJSON from '@/data/warsaw-districts.json';

export interface DistrictStats {
  district: string;
  avgPriceM2: number;
  medianPriceM2: number;
  listingCount: number;
  change30d: number;
  avgSize: number;
}

// Mock statistics for Warsaw districts (realistic 2025 prices)
export const DISTRICT_STATS: Record<string, DistrictStats> = {
  'Śródmieście': {
    district: 'Śródmieście',
    avgPriceM2: 24500,
    medianPriceM2: 23800,
    listingCount: 342,
    change30d: 1.2,
    avgSize: 52,
  },
  'Mokotów': {
    district: 'Mokotów',
    avgPriceM2: 18200,
    medianPriceM2: 17500,
    listingCount: 521,
    change30d: -0.5,
    avgSize: 58,
  },
  'Żoliborz': {
    district: 'Żoliborz',
    avgPriceM2: 19800,
    medianPriceM2: 19200,
    listingCount: 178,
    change30d: 2.1,
    avgSize: 55,
  },
  'Wola': {
    district: 'Wola',
    avgPriceM2: 17500,
    medianPriceM2: 16800,
    listingCount: 445,
    change30d: 0.8,
    avgSize: 48,
  },
  'Ochota': {
    district: 'Ochota',
    avgPriceM2: 16800,
    medianPriceM2: 16200,
    listingCount: 234,
    change30d: -0.3,
    avgSize: 54,
  },
  'Praga Północ': {
    district: 'Praga Północ',
    avgPriceM2: 14200,
    medianPriceM2: 13800,
    listingCount: 198,
    change30d: 3.2,
    avgSize: 45,
  },
  'Praga Południe': {
    district: 'Praga Południe',
    avgPriceM2: 14800,
    medianPriceM2: 14200,
    listingCount: 312,
    change30d: 1.5,
    avgSize: 52,
  },
  'Targówek': {
    district: 'Targówek',
    avgPriceM2: 13500,
    medianPriceM2: 13000,
    listingCount: 267,
    change30d: 0.9,
    avgSize: 50,
  },
  'Bielany': {
    district: 'Bielany',
    avgPriceM2: 15200,
    medianPriceM2: 14800,
    listingCount: 289,
    change30d: 0.4,
    avgSize: 56,
  },
  'Bemowo': {
    district: 'Bemowo',
    avgPriceM2: 14100,
    medianPriceM2: 13600,
    listingCount: 312,
    change30d: 1.8,
    avgSize: 54,
  },
  'Ursus': {
    district: 'Ursus',
    avgPriceM2: 12800,
    medianPriceM2: 12400,
    listingCount: 156,
    change30d: 2.4,
    avgSize: 52,
  },
  'Włochy': {
    district: 'Włochy',
    avgPriceM2: 13200,
    medianPriceM2: 12800,
    listingCount: 134,
    change30d: 0.6,
    avgSize: 58,
  },
  'Ursynów': {
    district: 'Ursynów',
    avgPriceM2: 15500,
    medianPriceM2: 15000,
    listingCount: 398,
    change30d: -0.2,
    avgSize: 55,
  },
  'Wilanów': {
    district: 'Wilanów',
    avgPriceM2: 16200,
    medianPriceM2: 15800,
    listingCount: 245,
    change30d: 1.1,
    avgSize: 62,
  },
  'Wawer': {
    district: 'Wawer',
    avgPriceM2: 12500,
    medianPriceM2: 12000,
    listingCount: 178,
    change30d: 1.9,
    avgSize: 65,
  },
  'Rembertów': {
    district: 'Rembertów',
    avgPriceM2: 11200,
    medianPriceM2: 10800,
    listingCount: 67,
    change30d: 0.5,
    avgSize: 58,
  },
  'Wesoła': {
    district: 'Wesoła',
    avgPriceM2: 10800,
    medianPriceM2: 10400,
    listingCount: 89,
    change30d: 2.8,
    avgSize: 72,
  },
  'Białołęka': {
    district: 'Białołęka',
    avgPriceM2: 12200,
    medianPriceM2: 11800,
    listingCount: 423,
    change30d: 1.3,
    avgSize: 54,
  },
};

// District center points for heat map (approximate centroids)
export interface DistrictCenter {
  name: string;
  lat: number;
  lng: number;
  stats: DistrictStats;
}

export const DISTRICT_CENTERS: DistrictCenter[] = [
  { name: 'Śródmieście', lat: 52.2319, lng: 21.0067, stats: DISTRICT_STATS['Śródmieście'] },
  { name: 'Mokotów', lat: 52.1935, lng: 21.0355, stats: DISTRICT_STATS['Mokotów'] },
  { name: 'Żoliborz', lat: 52.2697, lng: 20.9842, stats: DISTRICT_STATS['Żoliborz'] },
  { name: 'Wola', lat: 52.2389, lng: 20.9632, stats: DISTRICT_STATS['Wola'] },
  { name: 'Ochota', lat: 52.2135, lng: 20.9745, stats: DISTRICT_STATS['Ochota'] },
  { name: 'Praga Północ', lat: 52.2555, lng: 21.0412, stats: DISTRICT_STATS['Praga Północ'] },
  { name: 'Praga Południe', lat: 52.2245, lng: 21.0789, stats: DISTRICT_STATS['Praga Południe'] },
  { name: 'Targówek', lat: 52.2845, lng: 21.0623, stats: DISTRICT_STATS['Targówek'] },
  { name: 'Bielany', lat: 52.2912, lng: 20.9356, stats: DISTRICT_STATS['Bielany'] },
  { name: 'Bemowo', lat: 52.2534, lng: 20.9012, stats: DISTRICT_STATS['Bemowo'] },
  { name: 'Ursus', lat: 52.1956, lng: 20.8834, stats: DISTRICT_STATS['Ursus'] },
  { name: 'Włochy', lat: 52.1823, lng: 20.9234, stats: DISTRICT_STATS['Włochy'] },
  { name: 'Ursynów', lat: 52.1456, lng: 21.0389, stats: DISTRICT_STATS['Ursynów'] },
  { name: 'Wilanów', lat: 52.1534, lng: 21.0912, stats: DISTRICT_STATS['Wilanów'] },
  { name: 'Wawer', lat: 52.1867, lng: 21.1534, stats: DISTRICT_STATS['Wawer'] },
  { name: 'Rembertów', lat: 52.2623, lng: 21.1456, stats: DISTRICT_STATS['Rembertów'] },
  { name: 'Wesoła', lat: 52.2512, lng: 21.2234, stats: DISTRICT_STATS['Wesoła'] },
  { name: 'Białołęka', lat: 52.3234, lng: 21.0012, stats: DISTRICT_STATS['Białołęka'] },
];

// Process raw GeoJSON to add IDs and filter out the main "Warszawa" boundary
interface RawFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][][][];
  };
  properties: {
    name: string;
    cartodb_id?: number;
  };
}

interface ProcessedFeature {
  type: 'Feature';
  id: number;
  geometry: {
    type: string;
    coordinates: number[][][][];
  };
  properties: {
    name: string;
  };
}

const processedFeatures: ProcessedFeature[] = (rawGeoJSON as { features: RawFeature[] }).features
  .filter((f: RawFeature) => f.properties.name !== 'Warszawa') // Remove city boundary
  .map((f: RawFeature, index: number) => ({
    type: 'Feature' as const,
    id: index,
    geometry: f.geometry,
    properties: {
      name: f.properties.name,
    },
  }));

export const WARSAW_DISTRICTS_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: processedFeatures,
};

// Helper functions
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function getPriceColor(pricePerM2: number): string {
  if (pricePerM2 < 12000) return '#22c55e';
  if (pricePerM2 < 14000) return '#84cc16';
  if (pricePerM2 < 16000) return '#eab308';
  if (pricePerM2 < 18000) return '#f97316';
  if (pricePerM2 < 22000) return '#ef4444';
  return '#dc2626';
}
