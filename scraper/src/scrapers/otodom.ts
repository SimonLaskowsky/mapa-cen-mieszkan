import { chromium, type Page, type Browser, type BrowserContext } from 'playwright';
import type { ScrapedListing, ScraperConfig } from '../types.js';
import { insertListings, supabase, getDistrictMappings } from '../db.js';
import { extractOtodomId, normalizeDistrict, randomDelay } from '../utils/normalize.js';

const DEFAULT_CONFIG: ScraperConfig = {
  city: 'warszawa',
  offerType: 'sale',
  maxPages: 20,
  delayMs: 1500,
  headless: true,
};

// Otodom uses enum values for rooms/floor in the index listing payload.
// Detail page payload uses numeric strings ("4") or "floor_2" format.
const ROOMS_ENUM_MAP: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
  SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10, MORE: 11,
};

const FLOOR_ENUM_MAP: Record<string, number> = {
  CELLAR: -1, GROUND: 0,
  FIRST: 1, SECOND: 2, THIRD: 3, FOURTH: 4, FIFTH: 5,
  SIXTH: 6, SEVENTH: 7, EIGHTH: 8, NINTH: 9, TENTH: 10,
  ELEVENTH: 11, TWELFTH: 12, HIGHER: 13, GARRET: 14,
};

// Minimal shape of what we care about from __NEXT_DATA__ on an index page
interface OtodomIndexItem {
  id: number;
  slug: string;
  title: string;
  totalPrice: { value: number; currency: string } | null;
  pricePerSquareMeter: { value: number } | null;
  rentPrice?: { value: number } | null;
  areaInSquareMeters: number | null;
  roomsNumber?: string | null;
  floorNumber?: string | null;
  location?: {
    address?: {
      street?: { name?: string };
      city?: { name?: string };
      province?: { name?: string };
    };
    reverseGeocoding?: {
      locations?: Array<{ locationLevel: string; name: string; id: string }>;
    };
  };
  images?: Array<{ medium?: string; large?: string }>;
  shortDescription?: string;
}

interface OtodomSearchPage {
  items: OtodomIndexItem[];
  totalPages?: number;
}

// Detail page ad shape
interface OtodomCharacteristic {
  key: string;
  value: string;
  localizedValue: string;
}

interface OtodomAdDetail {
  id: number;
  title: string;
  slug: string;
  description?: string;
  url?: string;
  characteristics?: OtodomCharacteristic[];
  location?: {
    coordinates?: { latitude: number; longitude: number };
    address?: {
      street?: { name?: string; number?: string };
      district?: { code?: string; name?: string };
      city?: { name?: string; code?: string };
      subdistrict?: { code?: string; name?: string } | null;
    };
    reverseGeocoding?: {
      locations?: Array<{ locationLevel: string; name: string; id: string }>;
    };
  };
  target?: {
    Price?: number;
    Price_per_m?: number;
    Rent?: number;
    Area?: string;
    Rooms_num?: string[];
    Floor_no?: string[];
    Build_year?: string;
    Building_type?: string[];
    Heating?: string[];
    Construction_status?: string[];
    MarketType?: string;
  };
  images?: Array<{ medium?: string; large?: string }>;
}

// Evaluate-as-string trick: tsx/esbuild injects `__name` helpers into arrow
// function bodies which breaks `page.evaluate(() => {...})` inside the browser.
// Passing the function body as a string avoids transpilation.
const EXTRACT_NEXT_DATA_JS = `(function() {
  const el = document.getElementById('__NEXT_DATA__');
  return el && el.textContent ? el.textContent : null;
})()`;

export class OtodomScraper {
  private config: ScraperConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private districtMappings: Map<string, string> = new Map();

  constructor(config: Partial<ScraperConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async init(): Promise<void> {
    console.log('🚀 Initializing Otodom scraper...');

    this.browser = await chromium.launch({ headless: this.config.headless });
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      locale: 'pl-PL',
      extraHTTPHeaders: { 'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7' },
    });
    this.page = await this.context.newPage();

    this.districtMappings = await getDistrictMappings(this.config.city);
    console.log(`📍 Loaded ${this.districtMappings.size} district mappings for ${this.config.city}`);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  private buildSearchUrl(pageNum: number): string {
    const citySlug = this.config.city.toLowerCase();
    const transaction = this.config.offerType === 'sale' ? 'sprzedaz' : 'wynajem';
    return `https://www.otodom.pl/pl/oferty/${transaction}/mieszkanie/${citySlug}?page=${pageNum}`;
  }

  private buildDetailUrl(slug: string): string {
    return `https://www.otodom.pl/pl/oferta/${slug}`;
  }

  private async fetchNextData<T = unknown>(): Promise<T | null> {
    if (!this.page) throw new Error('Scraper not initialized');
    const raw = await this.page.evaluate(EXTRACT_NEXT_DATA_JS);
    if (typeof raw !== 'string' || raw.length === 0) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async scrapeIndexPage(pageNum: number): Promise<OtodomSearchPage> {
    if (!this.page) throw new Error('Scraper not initialized');

    const url = this.buildSearchUrl(pageNum);
    console.log(`📄 Index page ${pageNum}: ${url}`);

    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const nextData = await this.fetchNextData<{
        props?: {
          pageProps?: {
            data?: {
              searchAds?: { items?: OtodomIndexItem[]; totalPages?: number };
            };
          };
        };
      }>();

      const items = nextData?.props?.pageProps?.data?.searchAds?.items ?? [];
      const totalPages = nextData?.props?.pageProps?.data?.searchAds?.totalPages;
      console.log(`   Found ${items.length} listings${totalPages ? ` (${totalPages} total pages)` : ''}`);
      return { items, totalPages };
    } catch (err) {
      console.error(`   Error scraping index page ${pageNum}:`, err instanceof Error ? err.message : err);
      return { items: [] };
    }
  }

  async scrapeDetailPage(url: string): Promise<OtodomAdDetail | null> {
    if (!this.page) throw new Error('Scraper not initialized');

    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const nextData = await this.fetchNextData<{
        props?: { pageProps?: { ad?: OtodomAdDetail } };
      }>();
      return nextData?.props?.pageProps?.ad ?? null;
    } catch (err) {
      console.error(`   Detail fetch error (${url}):`, err instanceof Error ? err.message : err);
      return null;
    }
  }

  private parseRooms(
    enumValue: string | null | undefined,
    numericValues: string[] | undefined
  ): number | undefined {
    if (Array.isArray(numericValues) && numericValues[0]) {
      const n = parseInt(numericValues[0], 10);
      if (!isNaN(n)) return n;
    }
    if (enumValue && ROOMS_ENUM_MAP[enumValue] !== undefined) {
      return ROOMS_ENUM_MAP[enumValue];
    }
    return undefined;
  }

  private parseFloor(
    enumOrStringValue: string | null | undefined
  ): number | undefined {
    if (!enumOrStringValue) return undefined;
    if (FLOOR_ENUM_MAP[enumOrStringValue] !== undefined) return FLOOR_ENUM_MAP[enumOrStringValue];
    const m = enumOrStringValue.match(/^floor_(\d+)$/i);
    if (m) return parseInt(m[1], 10);
    if (enumOrStringValue === 'ground') return 0;
    if (enumOrStringValue === 'cellar') return -1;
    return undefined;
  }

  private districtCandidates(
    index: OtodomIndexItem,
    detail: OtodomAdDetail | null
  ): string[] {
    const candidates: string[] = [];

    const fromReverse = (
      locs: Array<{ locationLevel: string; name: string; id: string }> | undefined
    ): string | null => {
      if (!locs) return null;
      const dist = locs.find((l) => l.locationLevel === 'district');
      if (!dist) return null;
      const parts = dist.id.split('/');
      return parts[parts.length - 1] || null;
    };

    // reverseGeocoding is the most structured source — prefer it. Otodom sometimes
    // puts a residential (e.g. "grochow") into address.district.code, but the
    // reverseGeocoding hierarchy still correctly identifies the parent district
    // ("praga-poludnie").
    const detailReverse = fromReverse(detail?.location?.reverseGeocoding?.locations);
    if (detailReverse) candidates.push(detailReverse);

    const indexReverse = fromReverse(index.location?.reverseGeocoding?.locations);
    if (indexReverse && !candidates.includes(indexReverse)) candidates.push(indexReverse);

    const detailCode = detail?.location?.address?.district?.code;
    if (detailCode && !candidates.includes(detailCode)) candidates.push(detailCode);

    return candidates;
  }

  // Diagnostic counters — reset per scrape() call
  private rejectionCounts: Record<string, number> = {};
  private unknownDistricts: Set<string> = new Set();

  private buildListing(
    index: OtodomIndexItem,
    detail: OtodomAdDetail | null,
    detailUrl: string
  ): ScrapedListing | null {
    const externalId = extractOtodomId(detailUrl);
    if (!externalId) {
      this.rejectionCounts['no_external_id'] = (this.rejectionCounts['no_external_id'] ?? 0) + 1;
      return null;
    }

    // Prefer detail data (more reliable), fall back to index
    const price = detail?.target?.Price ?? index.totalPrice?.value ?? null;
    const areaRaw = detail?.target?.Area ?? index.areaInSquareMeters;
    const sizeM2 =
      typeof areaRaw === 'string' ? parseFloat(areaRaw.replace(',', '.')) : areaRaw ?? null;

    if (!price || price <= 0 || !sizeM2 || sizeM2 <= 0) {
      this.rejectionCounts['no_price_or_size'] = (this.rejectionCounts['no_price_or_size'] ?? 0) + 1;
      return null;
    }

    // District — try multiple sources (reverseGeocoding, address.district),
    // take the first that maps to a known DB district.
    const candidates = this.districtCandidates(index, detail);
    if (candidates.length === 0) {
      this.rejectionCounts['no_district'] = (this.rejectionCounts['no_district'] ?? 0) + 1;
      return null;
    }
    let normalizedDistrict: string | null = null;
    for (const raw of candidates) {
      normalizedDistrict = normalizeDistrict(raw, this.districtMappings);
      if (normalizedDistrict) break;
    }
    if (!normalizedDistrict) {
      this.rejectionCounts['unknown_district'] = (this.rejectionCounts['unknown_district'] ?? 0) + 1;
      candidates.forEach((c) => this.unknownDistricts.add(c));
      return null;
    }

    const coords = detail?.location?.coordinates;
    const street = detail?.location?.address?.street;
    const streetName = street?.name;
    const streetNumber = street?.number;
    const address = [streetName, streetNumber].filter(Boolean).join(' ') || undefined;

    const rooms = this.parseRooms(index.roomsNumber, detail?.target?.Rooms_num);
    const floor = this.parseFloor(detail?.target?.Floor_no?.[0] ?? index.floorNumber ?? null);

    const buildingYearStr = detail?.target?.Build_year;
    const buildingYear = buildingYearStr ? parseInt(buildingYearStr, 10) : undefined;

    const images = (detail?.images ?? index.images ?? [])
      .map((i) => i.large || i.medium)
      .filter((u): u is string => !!u);
    const thumbnailUrl = index.images?.[0]?.medium || images[0];

    return {
      externalId,
      source: 'otodom',
      city: this.config.city,
      district: normalizedDistrict,
      address,
      lat: coords?.latitude,
      lng: coords?.longitude,
      price: Math.round(price),
      sizeM2,
      rooms,
      offerType: this.config.offerType,
      url: detailUrl,
      title: detail?.title ?? index.title,
      thumbnailUrl,
      scrapedAt: new Date(),
      description: detail?.description,
      floor,
      buildingYear: !isNaN(buildingYear as number) ? buildingYear : undefined,
      buildingType: detail?.target?.Building_type?.[0],
      heating: detail?.target?.Heating?.[0],
      finishCondition: detail?.target?.Construction_status?.[0],
      photos: images.length > 0 ? images : undefined,
    };
  }

  /**
   * Given a list of external IDs, return the set that already exists in the DB
   * AND has an unchanged price (so we can skip the detail fetch).
   * A changed price means we re-fetch detail to pick up any other changes too.
   */
  private async findUpToDate(
    candidates: Array<{ externalId: string; indexPrice: number }>
  ): Promise<Set<string>> {
    if (candidates.length === 0) return new Set();

    const ids = candidates.map((c) => c.externalId);
    const { data, error } = await supabase
      .from('listings')
      .select('external_id, price')
      .in('external_id', ids);

    if (error || !data) return new Set();

    const dbPrices = new Map<string, number>();
    for (const row of data as Array<{ external_id: string; price: number }>) {
      dbPrices.set(row.external_id, row.price);
    }

    const upToDate = new Set<string>();
    for (const { externalId, indexPrice } of candidates) {
      const dbPrice = dbPrices.get(externalId);
      if (dbPrice !== undefined && dbPrice === Math.round(indexPrice)) {
        upToDate.add(externalId);
      }
    }
    return upToDate;
  }

  async scrape(options: { dryRun?: boolean } = {}): Promise<{
    total: number;
    inserted: number;
    skipped: number;
  }> {
    await this.init();

    let totalScraped = 0;
    let totalInserted = 0;
    let totalSkipped = 0;

    this.rejectionCounts = {};
    this.unknownDistricts = new Set();

    try {
      const startedAt = new Date();

      for (let pageNum = 1; pageNum <= this.config.maxPages; pageNum++) {
        const { items, totalPages } = await this.scrapeIndexPage(pageNum);
        if (items.length === 0) {
          console.log('📭 No more listings, stopping');
          break;
        }

        // Build URLs + prelim external_ids + index prices for dedup.
        // Otodom duplicates listings across "promoted" and regular slots, so
        // dedupe by externalId within this page before anything else.
        const seen = new Set<string>();
        const withIds = items
          .map((item) => {
            const url = this.buildDetailUrl(item.slug);
            const externalId = extractOtodomId(url);
            return { item, url, externalId, indexPrice: item.totalPrice?.value ?? 0 };
          })
          .filter((x): x is { item: OtodomIndexItem; url: string; externalId: string; indexPrice: number } => {
            if (!x.externalId || x.indexPrice <= 0) return false;
            if (seen.has(x.externalId)) return false;
            seen.add(x.externalId);
            return true;
          });

        const upToDate = await this.findUpToDate(
          withIds.map((x) => ({ externalId: x.externalId, indexPrice: x.indexPrice }))
        );

        const toDetail = withIds.filter((x) => !upToDate.has(x.externalId));
        totalSkipped += upToDate.size;
        console.log(
          `   → ${upToDate.size} unchanged (skipping), ${toDetail.length} to fetch detail`
        );

        const processed: ScrapedListing[] = [];
        for (let i = 0; i < toDetail.length; i++) {
          const { item, url } = toDetail[i];
          const detail = await this.scrapeDetailPage(url);
          const listing = this.buildListing(item, detail, url);
          if (listing) processed.push(listing);
          totalScraped++;
          if (i < toDetail.length - 1) {
            await randomDelay(600, 1400);
          }
        }

        if (processed.length > 0) {
          if (options.dryRun) {
            console.log(`   💡 DRY RUN — would insert ${processed.length} listings`);
            console.log(`   Sample: ${JSON.stringify(processed[0], null, 2).slice(0, 800)}`);
          } else {
            const inserted = await insertListings(processed);
            totalInserted += inserted;
            console.log(`   ✅ Upserted ${inserted} listings`);
          }
        }

        // Stop early if we reached the known totalPages
        if (totalPages && pageNum >= totalPages) {
          console.log(`📭 Reached last page (${totalPages}), stopping`);
          break;
        }

        await randomDelay(this.config.delayMs, this.config.delayMs * 2);
      }

      const elapsed = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1);
      console.log(`\n⏱️  Elapsed: ${elapsed}s`);

      const rejectionEntries = Object.entries(this.rejectionCounts);
      if (rejectionEntries.length > 0) {
        console.log('\n📉 Rejections:');
        for (const [reason, count] of rejectionEntries) {
          console.log(`   ${reason}: ${count}`);
        }
        if (this.unknownDistricts.size > 0) {
          console.log(
            `   unknown district slugs: ${Array.from(this.unknownDistricts).join(', ')}`
          );
        }
      }
    } finally {
      await this.close();
    }

    return { total: totalScraped, inserted: totalInserted, skipped: totalSkipped };
  }
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const city = args[0] || 'warszawa';
  const maxPages = parseInt(args[1] || '2', 10);
  const offerType = (args[2] === 'rent' ? 'rent' : 'sale') as 'sale' | 'rent';
  const dryRun = args.includes('--dry-run');
  const visible = args.includes('--visible');

  console.log(
    `\n🏠 Otodom Scraper — city=${city} offerType=${offerType} maxPages=${maxPages} ${
      dryRun ? '(DRY RUN)' : ''
    }\n`
  );

  const scraper = new OtodomScraper({
    city,
    offerType,
    maxPages,
    headless: !visible,
  });

  scraper
    .scrape({ dryRun })
    .then(({ total, inserted, skipped }) => {
      console.log(
        `\n✅ Done! Scraped: ${total}, Inserted: ${inserted}, Skipped (unchanged): ${skipped}`
      );
    })
    .catch((err) => {
      console.error('❌ Scraper failed:', err);
      process.exit(1);
    });
}
