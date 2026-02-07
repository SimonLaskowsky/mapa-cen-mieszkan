/**
 * Fetch district boundaries from OpenStreetMap via Overpass API.
 * Converts OSM relations to GeoJSON FeatureCollection.
 *
 * Usage: npx tsx scripts/fetch-districts.ts <city>
 * Example: npx tsx scripts/fetch-districts.ts gdansk
 */

import * as fs from 'fs';
import * as path from 'path';

interface OSMElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  nodes?: number[];
  members?: Array<{
    type: string;
    ref: number;
    role: string;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
}

interface OverpassResponse {
  elements: OSMElement[];
}

// City configs for Overpass queries
const CITY_CONFIGS: Record<string, { osmRelationId: number; adminLevel: number; outputFile: string }> = {
  gdansk: {
    osmRelationId: 2_597_485, // Gdańsk city (admin_level=8)
    adminLevel: 9,            // 34 dzielnice
    outputFile: 'gdansk-districts.json',
  },
  poznan: {
    osmRelationId: 165_941,   // Poznań city (admin_level=8)
    adminLevel: 9,            // ~42 osiedla
    outputFile: 'poznan-districts.json',
  },
  lodz: {
    osmRelationId: 1_582_777, // Łódź city (admin_level=8)
    adminLevel: 9,            // 5 large dzielnice
    outputFile: 'lodz-districts.json',
  },
};

async function fetchOverpass(query: string): Promise<OverpassResponse> {
  const url = 'https://overpass-api.de/api/interpreter';
  console.log('  Querying Overpass API...');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function buildRingsFromMembers(
  members: NonNullable<OSMElement['members']>
): number[][][][] {
  // Collect outer and inner way geometries
  const outerWays: Array<Array<[number, number]>> = [];
  const innerWays: Array<Array<[number, number]>> = [];

  for (const member of members) {
    if (member.type !== 'way' || !member.geometry) continue;
    const coords: Array<[number, number]> = member.geometry.map((p) => [p.lon, p.lat]);
    if (member.role === 'outer') {
      outerWays.push(coords);
    } else if (member.role === 'inner') {
      innerWays.push(coords);
    }
  }

  // Merge outer ways into closed rings
  const outerRings = mergeWaysIntoRings(outerWays);
  const innerRings = mergeWaysIntoRings(innerWays);

  if (outerRings.length === 0) return [];

  // Build MultiPolygon: each outer ring is a polygon, inner rings added to first polygon
  const polygons: number[][][][] = outerRings.map((ring) => [ring]);

  // Add inner rings (holes) to the first polygon
  for (const inner of innerRings) {
    polygons[0].push(inner);
  }

  return polygons;
}

function mergeWaysIntoRings(ways: Array<Array<[number, number]>>): number[][][] {
  if (ways.length === 0) return [];

  const rings: number[][][] = [];
  const remaining = [...ways];

  while (remaining.length > 0) {
    let ring = remaining.shift()!;

    // Keep trying to extend the ring
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < remaining.length; i++) {
        const way = remaining[i];
        const ringEnd = ring[ring.length - 1];
        const wayStart = way[0];
        const wayEnd = way[way.length - 1];

        if (coordsEqual(ringEnd, wayStart)) {
          ring = ring.concat(way.slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        } else if (coordsEqual(ringEnd, wayEnd)) {
          ring = ring.concat([...way].reverse().slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        } else if (coordsEqual(ring[0], wayEnd)) {
          ring = way.concat(ring.slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        } else if (coordsEqual(ring[0], wayStart)) {
          ring = [...way].reverse().concat(ring.slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        }
      }
    }

    // Close ring if needed
    if (!coordsEqual(ring[0], ring[ring.length - 1])) {
      ring.push(ring[0]);
    }

    rings.push(ring);
  }

  return rings;
}

function coordsEqual(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
}

async function fetchCity(cityKey: string) {
  const config = CITY_CONFIGS[cityKey];
  if (!config) {
    console.error(`Unknown city: ${cityKey}. Available: ${Object.keys(CITY_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  console.log(`\nFetching districts for: ${cityKey}`);

  // Use 'out geom' to get geometry inline (much more efficient than out body + >)
  const query = `
    [out:json][timeout:300];
    area(${3_600_000_000 + config.osmRelationId})->.city;
    (
      relation["boundary"="administrative"]["admin_level"="${config.adminLevel}"](area.city);
    );
    out geom;
  `;

  const data = await fetchOverpass(query);
  let relations = data.elements.filter((e) => e.type === 'relation');

  console.log(`  Found ${relations.length} district relations`);

  if (relations.length === 0) {
    console.log('  No districts found. Trying admin_level=10...');
    const query2 = `
      [out:json][timeout:300];
      area(${3_600_000_000 + config.osmRelationId})->.city;
      (
        relation["boundary"="administrative"]["admin_level"="10"](area.city);
      );
      out geom;
    `;
    const data2 = await fetchOverpass(query2);
    relations = data2.elements.filter((e) => e.type === 'relation');

    if (relations.length === 0) {
      console.error('  Still no districts found. Check OSM data.');
      return;
    }
    console.log(`  Found ${relations.length} districts at admin_level=10`);
  }

  // Build GeoJSON features (geometry is already inline from 'out geom')
  const features = [];

  for (const rel of relations) {
    const name = rel.tags?.name || rel.tags?.['name:pl'] || `District ${rel.id}`;

    if (!rel.members) continue;

    const polygons = buildRingsFromMembers(rel.members);

    if (polygons.length === 0) {
      console.log(`  ⚠ Skipping ${name} - no valid geometry`);
      continue;
    }

    features.push({
      type: 'Feature' as const,
      properties: {
        name,
      },
      geometry: {
        type: 'MultiPolygon' as const,
        coordinates: polygons,
      },
    });
  }

  console.log(`  Built ${features.length} GeoJSON features`);

  const geojson = {
    type: 'FeatureCollection' as const,
    features,
  };

  // Write output
  const outputPath = path.join(process.cwd(), 'src', 'data', config.outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
  console.log(`  ✅ Written to ${config.outputFile} (${features.length} districts)`);

  // Print district names
  console.log('  Districts:');
  features.forEach((f) => console.log(`    - ${f.properties.name}`));
}

// Main
const city = process.argv[2];
if (!city) {
  console.log('Usage: npx tsx scripts/fetch-districts.ts <city>');
  console.log(`Available cities: ${Object.keys(CITY_CONFIGS).join(', ')}`);
  console.log('Or use "all" to fetch all cities');
  process.exit(1);
}

if (city === 'all') {
  (async () => {
    for (const key of Object.keys(CITY_CONFIGS)) {
      await fetchCity(key);
      // Rate limit: wait 5s between requests
      console.log('  Waiting 5s before next request...');
      await new Promise((r) => setTimeout(r, 5000));
    }
  })();
} else {
  fetchCity(city);
}
