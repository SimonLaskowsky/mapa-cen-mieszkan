const fs = require('fs');

// Read raw OSM data
const raw = JSON.parse(fs.readFileSync('/tmp/katowice-raw.json', 'utf8'));

// Convert OSM relations to GeoJSON features
const features = raw.elements.map((rel, index) => {
  const name = rel.tags?.name || `District ${index}`;

  // Collect all outer way geometries
  const outerWays = rel.members
    .filter(m => m.role === 'outer' && m.geometry)
    .map(m => m.geometry.map(p => [p.lon, p.lat]));

  // Try to connect ways into a single polygon
  let coordinates = [];
  if (outerWays.length > 0) {
    // Simple approach: concatenate all ways
    let ring = [];
    for (const way of outerWays) {
      if (ring.length === 0) {
        ring = [...way];
      } else {
        // Check if this way connects to the current ring
        const lastPoint = ring[ring.length - 1];
        const firstPoint = way[0];
        const lastPointOfWay = way[way.length - 1];

        if (Math.abs(lastPoint[0] - firstPoint[0]) < 0.0001 &&
            Math.abs(lastPoint[1] - firstPoint[1]) < 0.0001) {
          ring = [...ring, ...way.slice(1)];
        } else if (Math.abs(lastPoint[0] - lastPointOfWay[0]) < 0.0001 &&
                   Math.abs(lastPoint[1] - lastPointOfWay[1]) < 0.0001) {
          ring = [...ring, ...way.reverse().slice(1)];
        } else {
          // Just append
          ring = [...ring, ...way];
        }
      }
    }

    // Close the ring if needed
    if (ring.length > 0) {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (Math.abs(first[0] - last[0]) > 0.0001 || Math.abs(first[1] - last[1]) > 0.0001) {
        ring.push(first);
      }
    }

    coordinates = [ring];
  }

  // Calculate centroid
  let centerLat = 0, centerLng = 0;
  if (coordinates[0] && coordinates[0].length > 0) {
    const points = coordinates[0];
    for (const p of points) {
      centerLng += p[0];
      centerLat += p[1];
    }
    centerLng /= points.length;
    centerLat /= points.length;
  }

  return {
    type: 'Feature',
    id: index,
    properties: {
      name: name,
      nazwa: name,
      center_lat: centerLat,
      center_lng: centerLng,
    },
    geometry: {
      type: 'Polygon',
      coordinates: coordinates,
    },
  };
});

const geojson = {
  type: 'FeatureCollection',
  features: features.filter(f => f.geometry.coordinates[0]?.length > 3),
};

console.log(`Converted ${geojson.features.length} districts:`);
geojson.features.forEach(f => console.log(`  - ${f.properties.name}`));

// Write output
fs.writeFileSync(
  '/Users/szymonlaskowski/Documents/coding/mapa-cen-mieszkan/src/data/katowice-districts.json',
  JSON.stringify(geojson, null, 2)
);

console.log('\nSaved to src/data/katowice-districts.json');
