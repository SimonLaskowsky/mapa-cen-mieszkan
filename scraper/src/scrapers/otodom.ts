import { chromium, type Page, type Browser } from 'playwright';
import type { ScrapedListing, ScraperConfig } from '../types.js';
import { getDistrictMappings, insertListings } from '../db.js';
import {
  normalizeDistrict,
  parsePrice,
  parseSize,
  parseRooms,
  extractOtodomId,
  randomDelay,
} from '../utils/normalize.js';

const DEFAULT_CONFIG: ScraperConfig = {
  city: 'warszawa',
  maxPages: 50,
  delayMs: 2000,
  headless: true,
};

interface OtodomListing {
  url: string;
  title: string;
  price: string;
  size: string;
  rooms: string;
  location: string;
}

export class OtodomScraper {
  private config: ScraperConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private districtMappings: Map<string, string> = new Map();

  constructor(config: Partial<ScraperConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async init(): Promise<void> {
    console.log('🚀 Initializing Otodom scraper...');

    this.browser = await chromium.launch({
      headless: this.config.headless,
    });

    this.page = await this.browser.newPage();

    // Set realistic viewport and user agent
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    // Load district mappings
    this.districtMappings = await getDistrictMappings(this.config.city);
    console.log(`📍 Loaded ${this.districtMappings.size} district mappings for ${this.config.city}`);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  private buildSearchUrl(page: number): string {
    const citySlug = this.config.city.toLowerCase();
    // Otodom search URL for apartments for sale
    return `https://www.otodom.pl/pl/wyniki/sprzedaz/mieszkanie/${citySlug}/${citySlug}/${citySlug}?page=${page}&limit=72`;
  }

  async scrapeListingsPage(pageNum: number): Promise<OtodomListing[]> {
    if (!this.page) throw new Error('Scraper not initialized');

    const url = this.buildSearchUrl(pageNum);
    console.log(`📄 Scraping page ${pageNum}: ${url}`);

    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for listings to load
      await this.page.waitForSelector('[data-cy="listing-item"]', { timeout: 10000 });

      // Extract listing data
      const listings = await this.page.evaluate(() => {
        const items = document.querySelectorAll('[data-cy="listing-item"]');
        const results: OtodomListing[] = [];

        items.forEach((item) => {
          const linkEl = item.querySelector('a[href*="/oferta/"]');
          const priceEl = item.querySelector('[data-cy="listing-item-price"]');
          const areaEl = item.querySelector('span[data-testid="listing-item-area"]') ||
                         item.querySelector('[aria-label*="Powierzchnia"]');
          const roomsEl = item.querySelector('span[data-testid="listing-item-rooms"]') ||
                          item.querySelector('[aria-label*="pokoje"]');
          const locationEl = item.querySelector('[data-testid="listing-item-location"]') ||
                             item.querySelector('p.css-1dvtw4c'); // fallback selector

          if (linkEl && priceEl) {
            results.push({
              url: (linkEl as HTMLAnchorElement).href,
              title: linkEl.textContent?.trim() || '',
              price: priceEl.textContent?.trim() || '',
              size: areaEl?.textContent?.trim() || '',
              rooms: roomsEl?.textContent?.trim() || '',
              location: locationEl?.textContent?.trim() || '',
            });
          }
        });

        return results;
      });

      console.log(`   Found ${listings.length} listings`);
      return listings;
    } catch (error) {
      console.error(`   Error scraping page ${pageNum}:`, error);
      return [];
    }
  }

  private parseLocation(location: string): { district: string | null; address: string | null } {
    // Location format: "Dzielnica, Miasto" or "Ulica, Dzielnica, Miasto"
    const parts = location.split(',').map((p) => p.trim());

    if (parts.length >= 2) {
      // Try to find district in the parts
      for (const part of parts) {
        const normalized = normalizeDistrict(part, this.districtMappings);
        if (normalized) {
          return {
            district: normalized,
            address: parts[0] !== part ? parts[0] : null,
          };
        }
      }
    }

    return { district: null, address: null };
  }

  async processListings(rawListings: OtodomListing[]): Promise<ScrapedListing[]> {
    const processed: ScrapedListing[] = [];
    const now = new Date();

    for (const raw of rawListings) {
      const externalId = extractOtodomId(raw.url);
      if (!externalId) continue;

      const price = parsePrice(raw.price);
      const size = parseSize(raw.size);
      if (!price || !size) continue;

      const { district, address } = this.parseLocation(raw.location);
      if (!district) {
        // Skip listings without a matched district
        continue;
      }

      processed.push({
        externalId,
        source: 'otodom',
        city: this.config.city,
        district,
        address: address || undefined,
        price,
        sizeM2: size,
        rooms: parseRooms(raw.rooms) || undefined,
        offerType: 'sale',
        url: raw.url,
        title: raw.title || undefined,
        scrapedAt: now,
      });
    }

    return processed;
  }

  async scrape(): Promise<{ total: number; inserted: number }> {
    await this.init();

    let totalScraped = 0;
    let totalInserted = 0;

    try {
      for (let page = 1; page <= this.config.maxPages; page++) {
        const rawListings = await this.scrapeListingsPage(page);

        if (rawListings.length === 0) {
          console.log('📭 No more listings found, stopping');
          break;
        }

        const processed = await this.processListings(rawListings);
        totalScraped += rawListings.length;

        if (processed.length > 0) {
          const inserted = await insertListings(processed);
          totalInserted += inserted;
          console.log(`   Processed: ${processed.length}, Inserted: ${inserted}`);
        }

        // Random delay to be respectful
        if (page < this.config.maxPages) {
          await randomDelay(this.config.delayMs, this.config.delayMs * 2);
        }
      }
    } finally {
      await this.close();
    }

    return { total: totalScraped, inserted: totalInserted };
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const city = process.argv[2] || 'warszawa';
  const maxPages = parseInt(process.argv[3] || '5', 10);

  console.log(`\n🏠 Otodom Scraper - ${city}\n`);

  const scraper = new OtodomScraper({
    city,
    maxPages,
    headless: true,
  });

  scraper
    .scrape()
    .then(({ total, inserted }) => {
      console.log(`\n✅ Done! Scraped: ${total}, Inserted: ${inserted}`);
    })
    .catch((error) => {
      console.error('❌ Scraper failed:', error);
      process.exit(1);
    });
}
