import { chromium, type Page, type Browser } from 'playwright';
import type { ScrapedListing, ScraperConfig } from '../types.js';
import { getDistrictMappings, insertListings } from '../db.js';
import {
  normalizeDistrict,
  parsePrice,
  parseSize,
  parseRooms,
  randomDelay,
} from '../utils/normalize.js';

const DEFAULT_CONFIG: ScraperConfig = {
  city: 'warszawa',
  offerType: 'sale',
  maxPages: 50,
  delayMs: 2000,
  headless: true,
};

interface MorizonListing {
  url: string;
  title: string;
  price: string;
  size: string;
  rooms: string;
  location: string;
  externalId: string;
  thumbnailUrl: string | null;
}

export class MorizonScraper {
  private config: ScraperConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private districtMappings: Map<string, string> = new Map();

  constructor(config: Partial<ScraperConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async init(): Promise<void> {
    console.log('🚀 Initializing Morizon scraper...');

    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'pl-PL',
      timezoneId: 'Europe/Warsaw',
    });

    this.page = await context.newPage();

    // Set extra headers
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    // Hide webdriver
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
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
    // Morizon URL structure: /mieszkania/ for sale, /do-wynajecia/mieszkania/ for rent
    const pathPrefix = this.config.offerType === 'sale' ? 'mieszkania' : 'do-wynajecia/mieszkania';

    // Page 1 has no page parameter, subsequent pages use ?page=N
    if (page === 1) {
      return `https://www.morizon.pl/${pathPrefix}/${citySlug}/`;
    }
    return `https://www.morizon.pl/${pathPrefix}/${citySlug}/?page=${page}`;
  }

  async acceptCookies(): Promise<void> {
    if (!this.page) return;

    try {
      // Try various cookie consent button selectors
      const cookieSelectors = [
        'button[id*="accept"]',
        'button[class*="accept"]',
        '[data-testid="cookie-accept"]',
        '.cookie-consent button',
        '#onetrust-accept-btn-handler',
        '.cmp-button_button',
        'button:has-text("Akceptuję")',
        'button:has-text("Zgadzam się")',
        'button:has-text("Accept")',
      ];

      for (const selector of cookieSelectors) {
        const btn = await this.page.$(selector);
        if (btn) {
          await btn.click();
          console.log('   🍪 Accepted cookies');
          await randomDelay(1000, 2000);
          break;
        }
      }
    } catch (e) {
      // Ignore cookie errors
    }
  }

  async scrapeListingsPage(pageNum: number): Promise<MorizonListing[]> {
    if (!this.page) throw new Error('Scraper not initialized');

    const url = this.buildSearchUrl(pageNum);
    console.log(`📄 Scraping page ${pageNum}: ${url}`);

    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Accept cookies on first page
      if (pageNum === 1) {
        await randomDelay(2000, 3000);
        await this.acceptCookies();
      }

      // Wait for property cards to load
      try {
        await this.page.waitForSelector('.property-card', { timeout: 10000 });
        console.log('   ✓ Property cards loaded');
      } catch {
        console.log('   ⚠️ Property cards not found, waiting longer...');
        await randomDelay(3000, 5000);
      }

      // Give page time to fully render
      await randomDelay(1000, 2000);

      // Extract listing data using Morizon's stable selectors
      // Note: .property-card is actually an <a> tag (the clickable card),
      // while [data-cy="card"] is the parent container
      const { listings, debug } = await this.page.evaluate(() => {
        const results: MorizonListing[] = [];
        const debugInfo: string[] = [];

        // Query parent card containers - each contains the property details
        const cardContainers = document.querySelectorAll('[data-cy="card"]');
        debugInfo.push(`Found ${cardContainers.length} [data-cy="card"] containers`);

        cardContainers.forEach((card, index) => {
          try {
            // .property-card IS the link (it's an <a> tag)
            const linkEl = card.querySelector('a.property-card[href*="/oferta/"]') ||
                          card.querySelector('[data-cy="propertyUrl"]');

            if (!linkEl) {
              return; // Skip cards without links (might be ads)
            }

            const href = (linkEl as HTMLAnchorElement).href;

            // Extract ID from URL (format: mzn1234567890)
            const idMatch = href.match(/mzn(\d+)/) || href.match(/-(\d+)$/);
            const externalId = idMatch ? `morizon-${idMatch[1]}` : `morizon-${Date.now()}-${index}`;

            // Title - from .property-card__title
            const titleEl = card.querySelector('.property-card__title');

            // Price - from .property-card__price--main
            const priceEl = card.querySelector('.property-card__price--main');

            // Location - from .property-card__location
            const locationEl = card.querySelector('.property-card__location');

            // Property details - contains rooms and area
            const detailsEl = card.querySelector('.property-card__property-details');
            const detailsText = detailsEl?.textContent || '';

            // Parse rooms and size from details text
            // Format: "3 pokoje • 65 m²" or "3 pok. 65m²"
            const roomsMatch = detailsText.match(/(\d+)\s*pok/i);
            const sizeMatch = detailsText.match(/(\d+[,.]?\d*)\s*m[²2]/i);

            // Extract thumbnail image - look for actual property photos
            // Morizon uses img tags with src containing image hosting domains
            const imgEl = card.querySelector('img[src*="cdn"], img[src*="img"], img[data-src*="cdn"], img[data-src*="img"]');
            let thumbnailUrl: string | null = null;
            if (imgEl) {
              // Try data-src first (lazy loading), then src
              thumbnailUrl = (imgEl as HTMLImageElement).dataset.src ||
                            (imgEl as HTMLImageElement).src ||
                            null;
            }
            // Skip placeholder/default images (svg, camera icons, nuxt-assets, etc.)
            if (thumbnailUrl && (
              thumbnailUrl.includes('placeholder') ||
              thumbnailUrl.includes('no-image') ||
              thumbnailUrl.includes('.svg') ||
              thumbnailUrl.includes('nuxt-assets') ||
              thumbnailUrl.includes('camera')
            )) {
              thumbnailUrl = null;
            }

            results.push({
              url: href,
              externalId,
              title: titleEl?.textContent?.trim() || '',
              price: priceEl?.textContent?.trim() || '',
              size: sizeMatch ? sizeMatch[1].replace(',', '.') : '',
              rooms: roomsMatch ? roomsMatch[1] : '',
              location: locationEl?.textContent?.trim() || '',
              thumbnailUrl,
            });
          } catch (e) {
            debugInfo.push(`Card ${index}: Error - ${e}`);
          }
        });

        return { listings: results, debug: debugInfo };
      });

      // Log debug info
      if (debug.length > 0) {
        debug.forEach(d => console.log(`   [DEBUG] ${d}`));
      }

      console.log(`   Found ${listings.length} listings`);
      return listings;
    } catch (error) {
      console.error(`   Error scraping page ${pageNum}:`, error);
      return [];
    }
  }

  private parseLocation(location: string): { district: string | null; address: string | null } {
    if (!location) return { district: null, address: null };

    // Location format varies: "Dzielnica, Miasto" or "Ulica, Dzielnica, Miasto"
    const parts = location.split(',').map((p) => p.trim());

    // Also try splitting by other separators
    const allParts = location.split(/[,\-\/]/).map((p) => p.trim());

    for (const part of [...parts, ...allParts]) {
      const normalized = normalizeDistrict(part, this.districtMappings);
      if (normalized) {
        return {
          district: normalized,
          address: parts[0] !== part ? parts[0] : null,
        };
      }
    }

    return { district: null, address: null };
  }

  async processListings(rawListings: MorizonListing[]): Promise<ScrapedListing[]> {
    const processed: ScrapedListing[] = [];
    const now = new Date();

    for (const raw of rawListings) {
      const price = parsePrice(raw.price);
      const size = parseSize(raw.size);

      // Skip invalid listings
      // Different price validation for sale vs rent
      if (this.config.offerType === 'sale') {
        if (!price || price < 10000) continue; // Min 10k PLN for sale
      } else {
        if (!price || price < 500 || price > 50000) continue; // 500-50k PLN/month for rent
      }
      if (!size || size < 10 || size > 500) continue; // 10-500 m²

      const { district, address } = this.parseLocation(raw.location);
      if (!district) {
        // Try to extract district from title
        const titleDistrict = this.parseLocation(raw.title);
        if (!titleDistrict.district) continue;
      }

      const finalDistrict = district || this.parseLocation(raw.title).district;
      if (!finalDistrict) continue;

      processed.push({
        externalId: raw.externalId,
        source: 'morizon',
        city: this.config.city,
        district: finalDistrict,
        address: address || undefined,
        price,
        sizeM2: size,
        rooms: parseRooms(raw.rooms) || undefined,
        offerType: this.config.offerType,
        url: raw.url,
        title: raw.title || undefined,
        thumbnailUrl: raw.thumbnailUrl || undefined,
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
        } else {
          console.log(`   Processed: 0 (no matching districts)`);
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

  // Debug method to inspect page structure
  async debugPageStructure(): Promise<void> {
    await this.init();

    if (!this.page) throw new Error('Not initialized');

    const url = this.buildSearchUrl(1);
    console.log(`🔍 Debugging page structure: ${url}\n`);

    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait a bit for initial JS
    await randomDelay(2000, 3000);

    // Accept cookies
    await this.acceptCookies();

    // Wait for JS to load
    await randomDelay(5000, 7000);

    // Take screenshot
    await this.page.screenshot({ path: 'debug-morizon.png', fullPage: true });
    console.log('📸 Screenshot saved to debug-morizon.png');

    // Get page HTML structure
    const structure = await this.page.evaluate(() => {
      const body = document.body;

      // Find all elements that might be listings
      const candidates = [
        ...document.querySelectorAll('[class*="listing"]'),
        ...document.querySelectorAll('[class*="offer"]'),
        ...document.querySelectorAll('[class*="card"]'),
        ...document.querySelectorAll('[class*="item"]'),
        ...document.querySelectorAll('[class*="result"]'),
        ...document.querySelectorAll('article'),
        ...document.querySelectorAll('[data-cy]'),
        ...document.querySelectorAll('[data-testid]'),
      ];

      const uniqueSelectors = new Set<string>();
      candidates.forEach(el => {
        if (el.className) {
          uniqueSelectors.add(el.className);
        }
        const dataCy = el.getAttribute('data-cy');
        if (dataCy) uniqueSelectors.add(`[data-cy="${dataCy}"]`);
        const dataTestId = el.getAttribute('data-testid');
        if (dataTestId) uniqueSelectors.add(`[data-testid="${dataTestId}"]`);
      });

      // Find links to offers
      const offerLinks = document.querySelectorAll('a[href*="/oferta/"], a[href*="mieszkanie"]');

      // Get some sample text from the page
      const mainContent = document.querySelector('main')?.textContent?.slice(0, 500) || '';

      return {
        title: document.title,
        url: window.location.href,
        candidateClasses: Array.from(uniqueSelectors).slice(0, 30),
        offerLinksCount: offerLinks.length,
        sampleOfferLinks: Array.from(offerLinks).slice(0, 5).map(a => (a as HTMLAnchorElement).href),
        bodyClasses: body.className,
        hasMainContent: mainContent.length > 100,
        sampleContent: mainContent.slice(0, 200),
      };
    });

    console.log('\nPage structure:', JSON.stringify(structure, null, 2));

    // Save HTML for manual inspection
    const html = await this.page.content();
    const fs = await import('fs');
    fs.writeFileSync('debug-morizon.html', html);
    console.log('\n📄 Full HTML saved to debug-morizon.html');

    await this.close();
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2] || 'scrape';
  const city = process.argv[3] || 'warszawa';
  const maxPages = parseInt(process.argv[4] || '3', 10);

  console.log(`\n🏠 Morizon Scraper - ${city}\n`);

  const scraper = new MorizonScraper({
    city,
    maxPages,
    headless: process.argv.includes('--visible') ? false : true,
  });

  if (command === 'debug') {
    scraper.debugPageStructure().catch(console.error);
  } else {
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
}
