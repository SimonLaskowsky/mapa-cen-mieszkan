// City data types and helpers

export interface DistrictStats {
  district: string;
  offerType?: string;
  avgPrice?: number;
  avgPriceM2: number;
  medianPriceM2: number;
  minPriceM2?: number;
  maxPriceM2?: number;
  listingCount: number;
  change30d: number;
  avgSize: number;
  rentalYield?: number;
}

export interface DistrictCenter {
  name: string;
  displayName?: string;
  lat: number;
  lng: number;
  stats: DistrictStats;
}

export interface CityData {
  DISTRICT_STATS: Record<string, DistrictStats>;
  DISTRICT_CENTERS: Array<{
    name: string;
    displayName?: string;
    lat: number;
    lng: number;
    stats: DistrictStats;
  }>;
  DISTRICTS_GEOJSON: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      id: number;
      geometry: GeoJSON.Geometry;
      properties: { name: string };
    }>;
  };
}

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
