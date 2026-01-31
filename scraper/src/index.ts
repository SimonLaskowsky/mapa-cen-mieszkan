import { MorizonScraper } from './scrapers/morizon.js';

const CITIES = ['warszawa', 'katowice'];
const MAX_PAGES_PER_CITY = 20;

async function main() {
  console.log('🏠 Mapa Cen Mieszkań - Daily Scraper\n');
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🌆 Cities: ${CITIES.join(', ')}`);
  console.log(`📄 Max pages per city: ${MAX_PAGES_PER_CITY}\n`);

  const results: { city: string; total: number; inserted: number }[] = [];

  for (const city of CITIES) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🏙️  Scraping ${city.toUpperCase()} from Morizon`);
    console.log(`${'='.repeat(50)}\n`);

    try {
      const scraper = new MorizonScraper({
        city,
        maxPages: MAX_PAGES_PER_CITY,
        headless: true,
        delayMs: 2000,
      });

      const { total, inserted } = await scraper.scrape();
      results.push({ city, total, inserted });
    } catch (error) {
      console.error(`❌ Failed to scrape ${city}:`, error);
      results.push({ city, total: 0, inserted: 0 });
    }
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log('📊 SUMMARY');
  console.log(`${'='.repeat(50)}`);

  let grandTotal = 0;
  let grandInserted = 0;

  for (const { city, total, inserted } of results) {
    console.log(`  ${city}: ${total} scraped, ${inserted} inserted`);
    grandTotal += total;
    grandInserted += inserted;
  }

  console.log(`\n  TOTAL: ${grandTotal} scraped, ${grandInserted} inserted`);
  console.log(`\n📅 Completed at: ${new Date().toISOString()}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
