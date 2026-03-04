import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import type { Feature, Polygon, MultiPolygon, GeoJSON } from 'geojson';
import { supabase } from '../db.js';
import type { RcnTransaction, RcnTransactionWithDistrict } from './types.js';

interface DistrictGeometry {
  district: string;
  city: string;
  geojson: GeoJSON;
}

export async function loadAllDistrictGeometries(cities: string[]): Promise<DistrictGeometry[]> {
  const { data, error } = await supabase
    .from('districts')
    .select('district, city, geojson')
    .in('city', cities);

  if (error) {
    console.error(`Error loading district geometries:`, error.message);
    return [];
  }
  return (data || []) as DistrictGeometry[];
}

function extractPolygon(geojson: GeoJSON): Feature<Polygon | MultiPolygon> | null {
  if (!geojson) return null;

  // Full GeoJSON Feature
  if (geojson.type === 'Feature') {
    const feat = geojson as Feature;
    if (feat.geometry?.type === 'Polygon' || feat.geometry?.type === 'MultiPolygon') {
      return feat as Feature<Polygon | MultiPolygon>;
    }
    return null;
  }

  // Raw geometry
  if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
    return {
      type: 'Feature',
      geometry: geojson as Polygon | MultiPolygon,
      properties: {},
    };
  }

  return null;
}

export function assignDistricts(
  transactions: RcnTransaction[],
  districts: DistrictGeometry[]
): RcnTransactionWithDistrict[] {
  // Pre-extract polygon features once (avoid repeated work per transaction)
  const polys = districts
    .map(d => ({ district: d.district, city: d.city, polygon: extractPolygon(d.geojson as GeoJSON) }))
    .filter((d): d is { district: string; city: string; polygon: Feature<Polygon | MultiPolygon> } => d.polygon !== null);

  const result: RcnTransactionWithDistrict[] = [];

  for (const tx of transactions) {
    const pt = point([tx.lng, tx.lat]);

    for (const { district, city, polygon } of polys) {
      if (booleanPointInPolygon(pt, polygon)) {
        // Override the placeholder city with the one from the matched district
        result.push({ ...tx, city, district });
        break;
      }
    }
  }

  return result;
}
