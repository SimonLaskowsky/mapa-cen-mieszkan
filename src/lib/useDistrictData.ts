'use client';

import { useState, useEffect } from 'react';
import type { CityData, DistrictStats } from './city-data';

// Import GeoJSON files for map rendering (these are static)
import warsawGeoJSON from '@/data/warsaw-districts.json';
import krakowGeoJSON from '@/data/krakow-districts.json';
import wroclawGeoJSON from '@/data/wroclaw-districts.json';
import katowiceGeoJSON from '@/data/katowice-districts.json';
import gdanskGeoJSON from '@/data/gdansk-districts.json';
import poznanGeoJSON from '@/data/poznan-districts.json';
import lodzGeoJSON from '@/data/lodz-districts.json';

const GEOJSON_MAP: Record<string, unknown> = {
  warszawa: warsawGeoJSON,
  krakow: krakowGeoJSON,
  wroclaw: wroclawGeoJSON,
  katowice: katowiceGeoJSON,
  gdansk: gdanskGeoJSON,
  poznan: poznanGeoJSON,
  lodz: lodzGeoJSON,
};

// City slug mapping (frontend uses 'warsaw', API uses 'warszawa')
const CITY_SLUG_MAP: Record<string, string> = {
  warsaw: 'warszawa',
  krakow: 'krakow',
  wroclaw: 'wroclaw',
  katowice: 'katowice',
  gdansk: 'gdansk',
  poznan: 'poznan',
  lodz: 'lodz',
};

interface APIDistrictData {
  district: string;
  offerType: string;
  date: string;
  avgPrice: number | null;
  avgPriceM2: number | null;
  medianPriceM2: number | null;
  minPriceM2: number | null;
  maxPriceM2: number | null;
  listingCount: number | null;
  newListings: number | null;
  avgSizeM2: number | null;
  change30d: number | null;
  rooms: {
    '1': number;
    '2': number;
    '3': number;
    '4+': number;
  };
  center: {
    lat: number;
    lng: number;
  } | null;
}

interface APIResponse {
  city: string;
  districts: APIDistrictData[];
  updatedAt: string | null;
}

export interface UseDistrictDataResult {
  data: CityData | null;
  loading: boolean;
  error: string | null;
  updatedAt: string | null;
}

// Get display name for a district (capitalize properly)
function getDisplayName(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Transform API response to CityData format
function transformAPIResponse(response: APIResponse, cityId: string): CityData {
  const apiSlug = CITY_SLUG_MAP[cityId] || cityId;
  const geoJSON = GEOJSON_MAP[apiSlug];

  // Build DISTRICT_STATS
  const DISTRICT_STATS: Record<string, DistrictStats> = {};
  response.districts.forEach(d => {
    DISTRICT_STATS[d.district] = {
      district: d.district,
      offerType: d.offerType,
      avgPrice: d.avgPrice || 0,
      avgPriceM2: d.avgPriceM2 || 0,
      medianPriceM2: d.medianPriceM2 || 0,
      minPriceM2: d.minPriceM2 || undefined,
      maxPriceM2: d.maxPriceM2 || undefined,
      listingCount: d.listingCount || 0,
      change30d: d.change30d || 0,
      avgSize: d.avgSizeM2 || 0,
    };
  });

  // Build DISTRICT_CENTERS
  const DISTRICT_CENTERS = response.districts
    .filter(d => d.center && d.avgPriceM2)
    .map(d => ({
      name: d.district,
      displayName: getDisplayName(d.district),
      lat: d.center!.lat,
      lng: d.center!.lng,
      stats: DISTRICT_STATS[d.district],
    }));

  // Process GeoJSON - add id to each feature if missing
  const processedGeoJSON = geoJSON ? {
    type: 'FeatureCollection' as const,
    features: (geoJSON as { features: Array<{ properties: { name?: string; nazwa?: string; osiedle?: string } }> }).features.map((feature, index) => {
      // Normalize the district name from various property names
      const rawName = feature.properties?.name ||
                     feature.properties?.nazwa ||
                     feature.properties?.osiedle ||
                     'Unknown';
      const normalizedName = rawName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-');

      return {
        ...feature,
        type: 'Feature' as const,
        id: index,
        properties: {
          ...feature.properties,
          name: normalizedName,
        },
      };
    }),
  } : { type: 'FeatureCollection' as const, features: [] };

  return {
    DISTRICT_STATS,
    DISTRICT_CENTERS,
    DISTRICTS_GEOJSON: processedGeoJSON as CityData['DISTRICTS_GEOJSON'],
  };
}

export function useDistrictData(cityId: string, offerType: 'sale' | 'rent' = 'sale'): UseDistrictDataResult {
  const [data, setData] = useState<CityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiSlug = CITY_SLUG_MAP[cityId] || cityId;
        const otherType = offerType === 'sale' ? 'rent' : 'sale';

        // Fetch both offer types in parallel
        const [primaryRes, secondaryRes] = await Promise.all([
          fetch(`/api/cities/${apiSlug}/districts?offerType=${offerType}`),
          fetch(`/api/cities/${apiSlug}/districts?offerType=${otherType}`),
        ]);

        if (!primaryRes.ok) {
          throw new Error(`Failed to fetch: ${primaryRes.status}`);
        }

        const apiData: APIResponse = await primaryRes.json();

        // Check if we have any data
        if (!apiData.districts || apiData.districts.length === 0) {
          throw new Error('No data available for this city');
        }

        const transformed = transformAPIResponse(apiData, cityId);

        // Compute rental yield if secondary data is available
        if (secondaryRes.ok) {
          const secondaryData: APIResponse = await secondaryRes.json();
          if (secondaryData.districts && secondaryData.districts.length > 0) {
            const secondaryByDistrict: Record<string, APIDistrictData> = {};
            secondaryData.districts.forEach(d => {
              secondaryByDistrict[d.district] = d;
            });

            Object.values(transformed.DISTRICT_STATS).forEach(stats => {
              const other = secondaryByDistrict[stats.district];
              if (!other) return;

              // Get sale price/m² and rent price + size
              const salePriceM2 = offerType === 'sale' ? stats.avgPriceM2 : (other.avgPriceM2 || 0);
              const rentAvgPrice = offerType === 'rent' ? (stats.avgPrice || 0) : (other.avgPrice || 0);
              const rentAvgSize = offerType === 'rent' ? (stats.avgSize || 0) : (other.avgSizeM2 || 0);

              if (salePriceM2 > 0 && rentAvgPrice > 0 && rentAvgSize > 0) {
                const rentPerM2 = rentAvgPrice / rentAvgSize;
                stats.rentalYield = (rentPerM2 * 12) / salePriceM2 * 100;
              }
            });

            // Also update yields in DISTRICT_CENTERS
            transformed.DISTRICT_CENTERS.forEach(center => {
              center.stats = transformed.DISTRICT_STATS[center.name];
            });
          }
        }

        setData(transformed);
        setUpdatedAt(apiData.updatedAt);
      } catch (err) {
        console.error('Error fetching district data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [cityId, offerType]);

  return { data, loading, error, updatedAt };
}
