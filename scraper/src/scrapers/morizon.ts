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

// Poland bounding box for sanity-checking extracted coordinates
const POLAND_BOUNDS = { minLat: 49, maxLat: 55, minLng: 14, maxLng: 25 };

export interface ListingDetails {
  lat?: number;
  lng?: number;
  description?: string;
  floor?: number;
  buildingYear?: number;
  buildingType?: string;
  heating?: string;
  finishCondition?: string;
  photos?: string[];
}

// Known Morizon property detail keys mapped to our fields
const DETAIL_KEYS: Record<string, keyof ListingDetails> = {
  'piętro': 'floor',
  'pietro': 'floor',
  'rok budowy': 'buildingYear',
  'rok_budowy': 'buildingYear',
  'rodzaj zabudowy': 'buildingType',
  'typ budynku': 'buildingType',
  'ogrzewanie': 'heating',
  'stan wykończenia': 'finishCondition',
  'stan': 'finishCondition',
};

export async function fetchListingDetails(url: string): Promise<ListingDetails> {
  const result: ListingDetails = {};

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pl-PL,pl;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return result;

    const html = await response.text();

    // === Extract from __NUXT_DATA__ (coordinates + structured data) ===
    const nuxtMatch = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nuxtMatch) {
      try {
        const data: unknown[] = JSON.parse(nuxtMatch[1]);

        // Extract coordinates (existing logic)
        for (let i = 0; i < data.length; i++) {
          const val = data[i];
          if (
            val !== null &&
            typeof val === 'object' &&
            !Array.isArray(val) &&
            'center' in val &&
            'zoom' in val
          ) {
            const centerIdx = (val as { center: number }).center;
            const centerObj = data[centerIdx];
            if (
              centerObj !== null &&
              typeof centerObj === 'object' &&
              !Array.isArray(centerObj) &&
              'latitude' in centerObj &&
              'longitude' in centerObj
            ) {
              const latIdx = (centerObj as { latitude: number; longitude: number }).latitude;
              const lngIdx = (centerObj as { latitude: number; longitude: number }).longitude;
              const lat = data[latIdx];
              const lng = data[lngIdx];
              if (
                typeof lat === 'number' &&
                typeof lng === 'number' &&
                lat > POLAND_BOUNDS.minLat && lat < POLAND_BOUNDS.maxLat &&
                lng > POLAND_BOUNDS.minLng && lng < POLAND_BOUNDS.maxLng
              ) {
                result.lat = lat;
                result.lng = lng;
              }
            }
          }
        }

        // Find the main property object (has keys like description, photos, floorFormatted, detailedInformation)
        let mainObj: Record<string, number> | null = null;
        for (let i = 0; i < data.length; i++) {
          const val = data[i];
          if (
            val && typeof val === 'object' && !Array.isArray(val) &&
            'description' in val && 'photos' in val && 'detailedInformation' in val
          ) {
            mainObj = val as Record<string, number>;
            break;
          }
        }

        if (mainObj) {
          // Extract description — it's HTML, strip tags to get plain text
          const descIdx = mainObj.description;
          if (typeof descIdx === 'number' && typeof data[descIdx] === 'string') {
            const rawDesc = data[descIdx] as string;
            const plainText = rawDesc
              .replace(/<[^>]+>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#8222;/g, '„')
              .replace(/&#8221;/g, '"')
              .replace(/\s+/g, ' ')
              .trim();
            if (plainText.length > 50) {
              result.description = plainText.slice(0, 2000);
            }
          }

          // Extract floor from floorFormatted (e.g., "piętro 1/12" or "1/12")
          const floorIdx = mainObj.floorFormatted;
          if (typeof floorIdx === 'number' && typeof data[floorIdx] === 'string') {
            const floorStr = data[floorIdx] as string;
            const floorMatch = floorStr.match(/(\d+)\s*\//);
            if (floorMatch) {
              const floorNum = parseInt(floorMatch[1], 10);
              if (floorNum >= 0 && floorNum <= 50) result.floor = floorNum;
            }
          }

          // Extract photos — base64-encoded URLs that decode to media.domy.pl image paths
          // Wrap with Morizon CDN: https://img1.staticmorizon.com.pl/thumb/BASE64
          const photosIdx = mainObj.photos;
          if (typeof photosIdx === 'number') {
            const photosArrRef = data[photosIdx];
            if (Array.isArray(photosArrRef)) {
              const photos: string[] = [];
              for (const photoIdx of photosArrRef) {
                if (typeof photoIdx === 'number') {
                  const photoObj = data[photoIdx];
                  // Each photo entry is an object with a key pointing to the base64 URL
                  if (photoObj && typeof photoObj === 'object' && !Array.isArray(photoObj)) {
                    for (const key of Object.values(photoObj as Record<string, number>)) {
                      if (typeof key === 'number' && typeof data[key] === 'string') {
                        const val = data[key] as string;
                        if (val.startsWith('aHR0') && val.length > 50) {
                          // Morizon CDN requires a size spec + filename suffix;
                          // the bare /thumb/{base64} form returns a 302 to a placeholder.
                          // 3x2_xs:fill_and_crop is the only size token that works.
                          photos.push(`https://img1.staticmorizon.com.pl/thumb/${val}/3x2_xs:fill_and_crop/image.jpg`);
                          break;
                        }
                      }
                    }
                  }
                }
              }
              if (photos.length > 0) {
                result.photos = photos.slice(0, 15);
              }
            }
          }

          // Extract building details (year, type, heating, condition)
          // detailedInformation and buildingDetailedInformation are arrays of {label, value} objects
          const detailArrays = [mainObj.detailedInformation, mainObj.buildingDetailedInformation];
          for (const arrIdx of detailArrays) {
            if (typeof arrIdx !== 'number') continue;
            const arr = data[arrIdx];
            if (!Array.isArray(arr)) continue;

            for (const itemIdx of arr) {
              if (typeof itemIdx !== 'number') continue;
              const item = data[itemIdx];
              if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

              const itemObj = item as Record<string, number>;
              // Resolve label and value through indices
              let label = '';
              let value = '';

              // Try 'label' or 'name' keys for the label
              for (const labelKey of ['label', 'name']) {
                if (labelKey in itemObj) {
                  const lIdx = itemObj[labelKey];
                  if (typeof lIdx === 'number' && typeof data[lIdx] === 'string') {
                    label = (data[lIdx] as string).toLowerCase().trim();
                    break;
                  }
                }
              }

              // Try 'value' or 'values' for the value
              for (const valKey of ['value', 'values']) {
                if (valKey in itemObj) {
                  const vIdx = itemObj[valKey];
                  if (typeof vIdx === 'number' && typeof data[vIdx] === 'string') {
                    value = (data[vIdx] as string).trim();
                    break;
                  }
                }
              }

              if (!label || !value) continue;

              if (label.includes('rok budowy') || label.includes('rok_budowy')) {
                const year = parseInt(value, 10);
                if (year >= 1800 && year <= 2030) result.buildingYear = year;
              } else if (label.includes('rodzaj zabudowy') || label.includes('typ budynku')) {
                result.buildingType = value.slice(0, 50);
              } else if (label.includes('ogrzewanie')) {
                result.heating = value.slice(0, 50);
              } else if (label.includes('stan nieruchomo') || label.includes('stan wyko') || label === 'stan') {
                result.finishCondition = value.slice(0, 50);
              } else if ((label.includes('pi\u0119tro') || label.includes('pietro')) && !result.floor) {
                // Fallback floor from detailedInformation (e.g., "1/12")
                const floorNum = parseInt(value, 10);
                if (!isNaN(floorNum) && floorNum >= 0 && floorNum <= 50) result.floor = floorNum;
              }
            }
          }
        }
      } catch {
        // JSON parse failed, continue with HTML extraction
      }
    }

    return result;
  } catch {
    return result;
  }
}

// Backwards-compatible wrapper
export async function fetchListingCoords(url: string): Promise<{ lat: number; lng: number } | null> {
  const details = await fetchListingDetails(url);
  if (details.lat && details.lng) return { lat: details.lat, lng: details.lng };
  return null;
}

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

      const details = await fetchListingDetails(raw.url);
      if (details.lat && details.lng) {
        process.stdout.write(` 📍 ${details.lat.toFixed(4)},${details.lng.toFixed(4)}`);
      }
      if (details.description) {
        process.stdout.write(` 📝`);
      }
      if (details.photos?.length) {
        process.stdout.write(` 📷${details.photos.length}`);
      }

      processed.push({
        externalId: raw.externalId,
        source: 'morizon',
        city: this.config.city,
        district: finalDistrict,
        address: address || undefined,
        lat: details.lat,
        lng: details.lng,
        price,
        sizeM2: size,
        rooms: parseRooms(raw.rooms) || undefined,
        offerType: this.config.offerType,
        url: raw.url,
        title: raw.title || undefined,
        thumbnailUrl: raw.thumbnailUrl || undefined,
        scrapedAt: now,
        description: details.description,
        floor: details.floor,
        buildingYear: details.buildingYear,
        buildingType: details.buildingType,
        heating: details.heating,
        finishCondition: details.finishCondition,
        photos: details.photos,
      });

      // Polite delay between listing page fetches
      await randomDelay(250, 450);
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
