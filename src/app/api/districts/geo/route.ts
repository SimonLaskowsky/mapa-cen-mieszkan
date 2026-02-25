import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { LatestDistrictStats, DistrictPriceChange } from '@/types/database';

interface BboxDistrict {
  id: string;
  city: string;
  district: string;
  center_lat: number;
  center_lng: number;
  geojson: {
    type: 'Feature';
    geometry: GeoJSON.Geometry;
    properties: Record<string, unknown>;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bbox = searchParams.get('bbox');
    const offerType = searchParams.get('offerType') || 'sale';

    if (!bbox) {
      return NextResponse.json({ error: 'Missing bbox parameter' }, { status: 400 });
    }

    if (offerType !== 'sale' && offerType !== 'rent') {
      return NextResponse.json({ error: 'Invalid offerType' }, { status: 400 });
    }

    const parts = bbox.split(',').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      return NextResponse.json({ error: 'Invalid bbox format. Expected: sw_lng,sw_lat,ne_lng,ne_lat' }, { status: 400 });
    }

    const [swLng, swLat, neLng, neLat] = parts;
    const supabase = createServerClient();

    // Step 1: Use bbox to find which cities have districts in the viewport
    const rpcParams = {
      sw_lng: swLng,
      sw_lat: swLat,
      ne_lng: neLng,
      ne_lat: neLat,
    };
    // Type assertion needed: RPC function defined in migration, not in generated types
    const { data: bboxDistricts, error: geoError } = await supabase
      .rpc('get_districts_in_bbox' as never, rpcParams as never) as unknown as {
        data: BboxDistrict[] | null;
        error: { message: string } | null;
      };

    if (geoError) {
      console.error('Error fetching districts in bbox:', geoError);
      return NextResponse.json({ error: 'Failed to fetch districts', details: geoError.message }, { status: 500 });
    }

    if (!bboxDistricts || bboxDistricts.length === 0) {
      return NextResponse.json({
        type: 'FeatureCollection',
        features: [],
        districtStats: {},
        districtCenters: [],
        cities: [],
        updatedAt: null,
      });
    }

    // Get unique cities from the bbox results (filter out city-level boundaries)
    const cities = [...new Set(
      bboxDistricts.filter(d => d.district !== d.city).map(d => d.city)
    )];

    if (cities.length === 0) {
      return NextResponse.json({
        type: 'FeatureCollection',
        features: [],
        districtStats: {},
        districtCenters: [],
        cities: [],
        updatedAt: null,
      });
    }

    // Step 2: Fetch ALL districts for the identified cities (not just bbox)
    // This prevents districts from disappearing when zooming in
    const { data: allCityDistricts, error: allError } = await supabase
      .from('districts')
      .select('id, city, district, center_lat, center_lng, geojson')
      .in('city', cities)
      .not('geom', 'is', null) as unknown as {
        data: BboxDistrict[] | null;
        error: { message: string } | null;
      };

    if (allError) {
      console.error('Error fetching all city districts:', allError);
      return NextResponse.json({ error: 'Failed to fetch districts', details: allError.message }, { status: 500 });
    }

    // Filter out city-level boundary features
    const filteredDistricts = (allCityDistricts || []).filter(d => d.district !== d.city);

    // Fetch stats and changes for all cities in bbox (both offer types for yield)
    const otherType = offerType === 'sale' ? 'rent' : 'sale';

    const [statsRes, changesRes, otherStatsRes] = await Promise.all([
      supabase
        .from('latest_district_stats')
        .select('*')
        .in('city', cities)
        .eq('offer_type', offerType)
        .returns<LatestDistrictStats[]>(),
      supabase
        .from('district_price_changes')
        .select('*')
        .in('city', cities)
        .eq('offer_type', offerType)
        .returns<DistrictPriceChange[]>(),
      supabase
        .from('latest_district_stats')
        .select('*')
        .in('city', cities)
        .eq('offer_type', otherType)
        .returns<LatestDistrictStats[]>(),
    ]);

    // Index stats and changes by city+district
    const statsMap = new Map<string, LatestDistrictStats>();
    (statsRes.data || []).forEach(s => {
      statsMap.set(`${s.city}:${s.district}`, s);
    });

    const changesMap = new Map<string, DistrictPriceChange>();
    (changesRes.data || []).forEach(c => {
      changesMap.set(`${c.city}:${c.district}`, c);
    });

    const otherStatsMap = new Map<string, LatestDistrictStats>();
    (otherStatsRes.data || []).forEach(s => {
      otherStatsMap.set(`${s.city}:${s.district}`, s);
    });

    // Build GeoJSON FeatureCollection + stats
    const districtStats: Record<string, {
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
    }> = {};

    const districtCenters: Array<{
      name: string;
      city: string;
      displayName: string;
      lat: number;
      lng: number;
    }> = [];

    const features = filteredDistricts.map((d, index) => {
      const key = `${d.city}:${d.district}`;
      const stat = statsMap.get(key);
      const change = changesMap.get(key);
      const otherStat = otherStatsMap.get(key);

      // Build stats entry
      if (stat) {
        const entry = {
          district: d.district,
          city: d.city,
          offerType,
          avgPrice: stat.avg_price || 0,
          avgPriceM2: stat.avg_price_m2 || 0,
          medianPriceM2: stat.median_price_m2 || 0,
          minPriceM2: stat.min_price_m2 || undefined,
          maxPriceM2: stat.max_price_m2 || undefined,
          listingCount: stat.listing_count || 0,
          change30d: change?.change_percent_30d || 0,
          avgSize: stat.avg_size_m2 || 0,
          rentalYield: undefined as number | undefined,
        };

        // Compute rental yield
        if (otherStat) {
          const salePriceM2 = offerType === 'sale' ? entry.avgPriceM2 : (otherStat.avg_price_m2 || 0);
          const rentAvgPrice = offerType === 'rent' ? entry.avgPrice : (otherStat.avg_price || 0);
          const rentAvgSize = offerType === 'rent' ? entry.avgSize : (otherStat.avg_size_m2 || 0);

          if (salePriceM2 > 0 && rentAvgPrice > 0 && rentAvgSize > 0) {
            const rentPerM2 = rentAvgPrice / rentAvgSize;
            entry.rentalYield = (rentPerM2 * 12) / salePriceM2 * 100;
          }
        }

        districtStats[d.district] = entry;
      }

      // Build center entry
      if (stat && (stat.avg_price_m2 || 0) > 0) {
        const displayName = d.district
          .split('-')
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

        districtCenters.push({
          name: d.district,
          city: d.city,
          displayName,
          lat: d.center_lat,
          lng: d.center_lng,
        });
      }

      // Normalize GeoJSON feature name
      const rawName = d.geojson?.properties?.name ||
                     d.geojson?.properties?.nazwa ||
                     d.geojson?.properties?.osiedle ||
                     d.district;
      const normalizedName = typeof rawName === 'string'
        ? rawName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')
        : d.district;

      // Handle both geojson formats: full Feature (has 'geometry' key) or raw geometry
      const geometry = d.geojson?.geometry || d.geojson;

      return {
        type: 'Feature' as const,
        id: index,
        geometry: geometry || null,
        properties: {
          name: normalizedName,
          city: d.city,
        },
      };
    }).filter(f => f.geometry !== null);

    const updatedAt = statsRes.data?.[0]?.date || null;

    return NextResponse.json({
      type: 'FeatureCollection',
      features,
      districtStats,
      districtCenters,
      cities,
      updatedAt,
    });
  } catch (error) {
    console.error('Unexpected error in /api/districts/geo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
