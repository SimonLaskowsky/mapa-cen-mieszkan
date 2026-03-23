// Quick smoke test for fetchListingCoords
// Run with: cd scraper && npx tsx src/scrapers/morizon.test.ts

import { fetchListingCoords } from './morizon.js';

const KNOWN_LISTING = {
  url: 'https://www.morizon.pl/oferta/sprzedaz-mieszkanie-warszawa-wola-zelazna-54-53m2-mzn2044711707',
  expectedLat: 52.2338737,
  expectedLng: 20.9915824,
  tolerance: 0.001, // ~100m
};

async function main() {
  console.log('Testing fetchListingCoords...\n');
  console.log(`URL: ${KNOWN_LISTING.url}\n`);

  const coords = await fetchListingCoords(KNOWN_LISTING.url);

  if (!coords) {
    console.error('❌ FAIL: returned null — page structure may have changed');
    process.exit(1);
  }

  console.log(`Got: lat=${coords.lat}, lng=${coords.lng}`);
  console.log(`Expected: lat=${KNOWN_LISTING.expectedLat}, lng=${KNOWN_LISTING.expectedLng}`);

  const latOk = Math.abs(coords.lat - KNOWN_LISTING.expectedLat) < KNOWN_LISTING.tolerance;
  const lngOk = Math.abs(coords.lng - KNOWN_LISTING.expectedLng) < KNOWN_LISTING.tolerance;

  if (latOk && lngOk) {
    console.log('\n✅ PASS');
  } else {
    console.error('\n❌ FAIL: coordinates outside tolerance');
    process.exit(1);
  }
}

main().catch(console.error);
