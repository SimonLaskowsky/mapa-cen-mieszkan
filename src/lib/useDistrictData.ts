'use client';

import { useState, useEffect } from 'react';
import type { CityData, DistrictStats } from './city-data';

// Import GeoJSON files for map rendering (these are static)
import warsawGeoJSON from '@/data/warsaw-districts.json';
import krakowGeoJSON from '@/data/krakow-districts.json';
import wroclawGeoJSON from '@/data/wroclaw-districts.json';
import katowiceGeoJSON from '@/data/katowice-districts.json';

const GEOJSON_MAP: Record<string, unknown> = {
  warszawa: warsawGeoJSON,
  krakow: krakowGeoJSON,
  wroclaw: wroclawGeoJSON,
  katowice: katowiceGeoJSON,
};

// City slug mapping (frontend uses 'warsaw', API uses 'warszawa')
const CITY_SLUG_MAP: Record<string, string> = {
  warsaw: 'warszawa',
  krakow: 'krakow',
  wroclaw: 'wroclaw',
  katowice: 'katowice',
};

interface APIDistrictData {
  district: string;
  date: string;
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
      avgPriceM2: d.avgPriceM2 || 0,
      medianPriceM2: d.medianPriceM2 || 0,
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

export function useDistrictData(cityId: string): UseDistrictDataResult {
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
        const response = await fetch(`/api/cities/${apiSlug}/districts`);

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }

        const apiData: APIResponse = await response.json();

        // Check if we have any data
        if (!apiData.districts || apiData.districts.length === 0) {
          // No data from API - could fall back to mock or show empty
          throw new Error('No data available for this city');
        }

        const transformed = transformAPIResponse(apiData, cityId);
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
  }, [cityId]);

  return { data, loading, error, updatedAt };
}
