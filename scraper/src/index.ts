import { MorizonScraper } from './scrapers/morizon.js';
import { OtodomScraper } from './scrapers/otodom.js';

const CITIES = ['warszawa', 'krakow', 'wroclaw', 'katowice', 'gdansk', 'poznan', 'lodz'];
const OFFER_TYPES: ('sale' | 'rent')[] = ['sale', 'rent'];
const MAX_PAGES_PER_CITY = 10;

interface SourceRunResult {
  total: number;
  inserted: number;
  skipped?: number;
}

interface Source {
  name: string;
  run: (config: {
    city: string;
    offerType: 'sale' | 'rent';
    maxPages: number;
    headless: boolean;
  }) => Promise<SourceRunResult>;
}

const SOURCES: Source[] = [
  {
    name: 'Morizon',
    run: (cfg) => new MorizonScraper({ ...cfg, delayMs: 2000 }).scrape(),
  },
  {
    name: 'Otodom',
    run: (cfg) => new OtodomScraper({ ...cfg, delayMs: 1500 }).scrape(),
  },
];

interface RunRow extends SourceRunResult {
  source: string;
  city: string;
  offerType: string;
  error?: string;
}

async function main() {
  console.log('🏠 Mapa Cen Mieszkań - Daily Scraper\n');
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🌆 Cities: ${CITIES.join(', ')}`);
  console.log(`💼 Offer types: ${OFFER_TYPES.join(', ')}`);
  console.log(`📡 Sources: ${SOURCES.map((s) => s.name).join(', ')}`);
  console.log(`📄 Max pages per city: ${MAX_PAGES_PER_CITY}\n`);

  const results: RunRow[] = [];

  for (const city of CITIES) {
    for (const offerType of OFFER_TYPES) {
      for (const source of SOURCES) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🏙️  [${source.name}] ${city.toUpperCase()} - ${offerType.toUpperCase()}`);
        console.log(`${'='.repeat(60)}\n`);

        try {
          const result = await source.run({
            city,
            offerType,
            maxPages: MAX_PAGES_PER_CITY,
            headless: true,
          });
          results.push({ source: source.name, city, offerType, ...result });
        } catch (error) {
          console.error(`❌ [${source.name}] Failed for ${city}/${offerType}:`, error);
          results.push({
            source: source.name,
            city,
            offerType,
            total: 0,
            inserted: 0,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log(`${'='.repeat(60)}`);

  let grandScraped = 0;
  let grandInserted = 0;
  let grandSkipped = 0;

  for (const r of results) {
    const skipStr = r.skipped !== undefined ? ` (skipped: ${r.skipped})` : '';
    const errStr = r.error ? ` ❌ ${r.error.slice(0, 80)}` : '';
    console.log(
      `  [${r.source.padEnd(8)}] ${r.city.padEnd(10)} ${r.offerType.padEnd(5)} : ${r.total} scraped, ${r.inserted} inserted${skipStr}${errStr}`
    );
    grandScraped += r.total;
    grandInserted += r.inserted;
    grandSkipped += r.skipped ?? 0;
  }

  console.log(`\n  TOTAL: ${grandScraped} scraped, ${grandInserted} inserted, ${grandSkipped} skipped (unchanged)`);
  console.log(`\n📅 Completed at: ${new Date().toISOString()}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
