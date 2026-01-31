import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    name?: string;
    nazwa?: string;
    osiedle?: string;      // Wroclaw
    DZIELNICY?: string;    // Gdansk
    [key: string]: unknown;
  };
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
}

interface GeoJSONCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

// Calculate centroid of a polygon
function calculateCentroid(coordinates: number[][][] | number[][][][]): { lat: number; lng: number } {
  let allPoints: number[][] = [];

  // Handle both Polygon and MultiPolygon
  if (typeof coordinates[0][0][0] === 'number') {
    // Polygon: number[][][]
    allPoints = (coordinates as number[][][]).flat();
  } else {
    // MultiPolygon: number[][][][]
    allPoints = (coordinates as number[][][][]).flat(2);
  }

  const sum = allPoints.reduce(
    (acc, point) => ({
      lng: acc.lng + point[0],
      lat: acc.lat + point[1],
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: sum.lat / allPoints.length,
    lng: sum.lng / allPoints.length,
  };
}

// Normalize district name
function normalizeDistrictName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics for comparison
    .replace(/\s+/g, '-');
}

async function seedDistricts() {
  const dataDir = path.join(process.cwd(), 'src', 'data');

  const cityFiles = [
    { file: 'warsaw-districts.json', city: 'warszawa' },
    { file: 'krakow-districts.json', city: 'krakow' },
    { file: 'wroclaw-districts.json', city: 'wroclaw' },
    // Gdansk is in TopoJSON format, needs conversion - skipping for now
    // { file: 'gdansk-districts.json', city: 'gdansk' },
  ];

  console.log('🌍 Seeding districts table...\n');

  let totalInserted = 0;

  for (const { file, city } of cityFiles) {
    const filePath = path.join(dataDir, file);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${file} not found, skipping ${city}`);
      continue;
    }

    const geojson: GeoJSONCollection = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`📍 Processing ${city} (${geojson.features.length} districts)...`);

    // Deduplicate by district name (keep the first one)
    const seenDistricts = new Set<string>();
    const districts = geojson.features
      .map((feature) => {
        // Different sources use different property names
        const name =
          feature.properties.name ||
          feature.properties.nazwa ||
          feature.properties.osiedle ||     // Wroclaw
          feature.properties.DZIELNICY ||   // Gdansk
          'Unknown';
        const normalizedName = normalizeDistrictName(name);
        const centroid = calculateCentroid(feature.geometry.coordinates);

        return {
          city,
          district: normalizedName,
          geojson: feature,
          center_lat: centroid.lat,
          center_lng: centroid.lng,
        };
      })
      .filter((d) => {
        if (seenDistricts.has(d.district)) {
          return false;
        }
        seenDistricts.add(d.district);
        return true;
      });

    console.log(`   (${districts.length} unique after deduplication)`);

    // Upsert districts (update if exists, insert if not)
    const { data, error } = await supabase
      .from('districts')
      .upsert(districts, {
        onConflict: 'city,district',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error(`   ❌ Error inserting ${city}:`, error.message);
    } else {
      console.log(`   ✅ Inserted/updated ${data?.length || 0} districts`);
      totalInserted += data?.length || 0;
    }
  }

  console.log(`\n✨ Done! Total districts: ${totalInserted}`);
}

seedDistricts().catch(console.error);
