// City data exports

import * as warsaw from './warsaw';
import * as krakow from './krakow';
import * as wroclaw from './wroclaw';

export type { DistrictStats, DistrictCenter } from './warsaw';

export interface CityData {
  DISTRICT_STATS: Record<string, warsaw.DistrictStats>;
  DISTRICT_CENTERS: Array<{
    name: string;
    displayName?: string;
    lat: number;
    lng: number;
    stats: warsaw.DistrictStats;
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

// Export city data by city ID
export const CITY_DATA: Record<string, CityData> = {
  warsaw: {
    DISTRICT_STATS: warsaw.DISTRICT_STATS,
    DISTRICT_CENTERS: warsaw.DISTRICT_CENTERS,
    DISTRICTS_GEOJSON: warsaw.DISTRICTS_GEOJSON as CityData['DISTRICTS_GEOJSON'],
  },
  krakow: {
    DISTRICT_STATS: krakow.DISTRICT_STATS,
    DISTRICT_CENTERS: krakow.DISTRICT_CENTERS,
    DISTRICTS_GEOJSON: krakow.DISTRICTS_GEOJSON as CityData['DISTRICTS_GEOJSON'],
  },
  wroclaw: {
    DISTRICT_STATS: wroclaw.DISTRICT_STATS,
    DISTRICT_CENTERS: wroclaw.DISTRICT_CENTERS,
    DISTRICTS_GEOJSON: wroclaw.DISTRICTS_GEOJSON as CityData['DISTRICTS_GEOJSON'],
  },
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
