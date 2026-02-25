'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { CityData, DistrictStats } from './city-data';

export type Bbox = [number, number, number, number]; // [sw_lng, sw_lat, ne_lng, ne_lat]

interface ApiDistrictStats {
  district: string;
  city: string;
  offerType: string;
  avgPrice: number;
  avgPriceM2: number;
  medianPriceM2: number;
  minPriceM2?: number;
  maxPriceM2?: number;
  listingCount: number;
  change30d: number;
  avgSize: number;
  rentalYield?: number;
}

interface ApiDistrictCenter {
  name: string;
  city: string;
  displayName: string;
  lat: number;
  lng: number;
}

interface ApiResponse {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id: number;
    geometry: GeoJSON.Geometry;
    properties: { name: string; city: string };
  }>;
  districtStats: Record<string, ApiDistrictStats>;
  districtCenters: ApiDistrictCenter[];
  cities: string[];
  updatedAt: string | null;
}

export interface UseViewportDistrictsResult {
  data: CityData | null;
  loading: boolean;
  error: string | null;
  updatedAt: string | null;
  visibleCities: string[];
}

export function useViewportDistricts(
  bbox: Bbox | null,
  offerType: 'sale' | 'rent' = 'sale'
): UseViewportDistrictsResult {
  const [data, setData] = useState<CityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [visibleCities, setVisibleCities] = useState<string[]>([]);

  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortController = useRef<AbortController>(undefined);
  const lastBboxStr = useRef<string>('');

  const fetchData = useCallback(async (currentBbox: Bbox, currentOfferType: string) => {
    const bboxStr = currentBbox.map(n => n.toFixed(4)).join(',');

    // Skip if bbox hasn't changed meaningfully
    if (bboxStr === lastBboxStr.current) return;
    lastBboxStr.current = bboxStr;

    // Abort previous request
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/districts/geo?bbox=${currentBbox.join(',')}&offerType=${currentOfferType}`,
        { signal: abortController.current.signal }
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`);
      }

      const apiData: ApiResponse = await res.json();

      // Transform to CityData format
      const DISTRICT_STATS: Record<string, DistrictStats> = {};
      Object.entries(apiData.districtStats).forEach(([key, s]) => {
        DISTRICT_STATS[key] = {
          district: s.district,
          offerType: s.offerType,
          avgPrice: s.avgPrice,
          avgPriceM2: s.avgPriceM2,
          medianPriceM2: s.medianPriceM2,
          minPriceM2: s.minPriceM2,
          maxPriceM2: s.maxPriceM2,
          listingCount: s.listingCount,
          change30d: s.change30d,
          avgSize: s.avgSize,
          rentalYield: s.rentalYield,
        };
      });

      const DISTRICT_CENTERS = apiData.districtCenters.map(c => ({
        name: c.name,
        displayName: c.displayName,
        lat: c.lat,
        lng: c.lng,
        stats: DISTRICT_STATS[c.name],
      })).filter(c => c.stats);

      const DISTRICTS_GEOJSON = {
        type: 'FeatureCollection' as const,
        features: apiData.features,
      };

      setData({
        DISTRICT_STATS,
        DISTRICT_CENTERS,
        DISTRICTS_GEOJSON: DISTRICTS_GEOJSON as CityData['DISTRICTS_GEOJSON'],
      });
      setVisibleCities(apiData.cities || []);
      setUpdatedAt(apiData.updatedAt);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Error fetching viewport districts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!bbox) return;

    // Debounce bbox changes by 300ms
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchData(bbox, offerType);
    }, 300);

    return () => {
      clearTimeout(debounceTimer.current);
    };
  }, [bbox, offerType, fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
      clearTimeout(debounceTimer.current);
    };
  }, []);

  return { data, loading, error, updatedAt, visibleCities };
}
