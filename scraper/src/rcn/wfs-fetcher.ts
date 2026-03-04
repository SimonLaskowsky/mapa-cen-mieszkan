import sax from 'sax';
import type { RcnTransaction } from './types.js';
import { epsg2180toWGS84 } from './project.js';
import { WFS_BASE_URL } from './config.js';

const PAGE_SIZE = 5000;
const FETCH_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

// Computed once per run — avoids repeated calls inside processFeature hot path
let CUTOFF_DATE: Date;

// The WFS server ignores ALL CQL_FILTER conditions (teryt, dates, bbox).
// We query the global Poland dataset and filter client-side.
// Default window: last 25 months. Override with RCN_START_DATE=YYYY-MM-DD for backfill.
function getCutoffDate(): Date {
  if (process.env.RCN_START_DATE) return new Date(process.env.RCN_START_DATE);
  const d = new Date();
  d.setMonth(d.getMonth() - 25);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// No teryt filter — server ignores it and returns global Poland dataset anyway.
function buildUrl(startIndex: number): string {
  const params = new URLSearchParams({
    SERVICE: 'WFS',
    VERSION: '2.0.0',
    REQUEST: 'GetFeature',
    TYPENAMES: 'ms:lokale',
    COUNT: String(PAGE_SIZE),
    STARTINDEX: String(startIndex),
    CQL_FILTER: `lok_funkcja='mieszkalna'`,
  });
  return `${WFS_BASE_URL}?${params.toString()}`;
}

async function fetchWithRetry(url: string): Promise<Response> {
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return response;
    } catch (err) {
      if (attempt === FETCH_RETRIES) throw err;
      console.warn(`    Attempt ${attempt} failed (${(err as Error).message}), retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  throw new Error('unreachable');
}

// city is left as '' — spatial join will assign it based on coordinates
function processFeature(featureData: Record<string, string>): RcnTransaction | null {
  const city = '';
  // sax.parser non-strict mode uppercases all tag names
  const coords = featureData['GML:POS'];
  // MS:LOK_CENA_BRUTTO = price of this specific unit (correct for price/m² calc)
  // MS:TRAN_CENA_BRUTTO = total transaction price (may cover multiple units)
  const priceStr = featureData['MS:LOK_CENA_BRUTTO'] || featureData['MS:TRAN_CENA_BRUTTO'];
  const areaStr = featureData['MS:LOK_POW_UZYT'];
  const marketTypeRaw = featureData['MS:TRAN_RODZAJ_RYNKU'];
  const dateStr = featureData['MS:DOK_DATA'];

  if (!coords || !priceStr || !areaStr) return null;

  const priceTotal = parseFloat(priceStr);
  const areaM2 = parseFloat(areaStr);
  if (isNaN(priceTotal) || isNaN(areaM2) || priceTotal <= 0 || areaM2 <= 0) return null;

  // gml:pos format in EPSG:2180: "northing easting" (Y X axis order)
  const parts = coords.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const northing = parseFloat(parts[0]);
  const easting = parseFloat(parts[1]);
  if (isNaN(northing) || isNaN(easting)) return null;

  const { lat, lng } = epsg2180toWGS84(northing, easting);

  // Sanity check: coordinates should be within Poland
  if (lat < 49 || lat > 55 || lng < 14 || lng > 24) return null;

  const transactionDate = dateStr ? new Date(dateStr) : null;
  if (!transactionDate || isNaN(transactionDate.getTime())) return null;

  // Client-side date filter (WFS server ignores CQL date conditions)
  if (transactionDate < CUTOFF_DATE) return null;

  const pricePerM2 = priceTotal / areaM2;
  // Sanity check: realistic price range for Polish residential market
  if (pricePerM2 < 500 || pricePerM2 > 200000) return null;

  return {
    city,
    lat,
    lng,
    priceTotal,
    areaM2,
    pricePerM2,
    transactionDate,
    marketType: marketTypeRaw === 'pierwotny' ? 'primary' : 'secondary',
  };
}

async function fetchPage(url: string): Promise<{ transactions: RcnTransaction[]; rawCount: number }> {
  const response = await fetchWithRetry(url);

  // Fetch as text and parse with non-streaming sax.parser() — simpler and more reliable
  const xml = await response.text();

  const transactions: RcnTransaction[] = [];
  let rawCount = 0;
  let inFeature = false;
  let currentEl = '';
  let featureData: Record<string, string> = {};

  // sax.parser(strict=false) is lenient with namespaced tags and malformed XML
  const parser = sax.parser(false, {});

  parser.onopentag = (node: { name: string }) => {
    currentEl = node.name;
    if (node.name === 'MS:LOKALE') {
      inFeature = true;
      featureData = {};
    }
  };

  parser.ontext = (text: string) => {
    if (!inFeature || !currentEl) return;
    const t = text.trim();
    if (!t) return;
    featureData[currentEl] = (featureData[currentEl] ?? '') + t;
  };

  parser.oncdata = (text: string) => {
    if (!inFeature || !currentEl) return;
    featureData[currentEl] = (featureData[currentEl] ?? '') + text;
  };

  parser.onclosetag = (name: string) => {
    if (name === 'MS:LOKALE') {
      rawCount++;
      inFeature = false;
      const tx = processFeature(featureData);
      if (tx) transactions.push(tx);
      featureData = {};
    } else if (inFeature) {
      currentEl = '';
    }
  };

  // Lenient error handling — log and resume rather than abort
  parser.onerror = (err: Error) => {
    console.warn('    SAX parse warning:', err.message);
    // Cast needed: sax types don't expose reset/resume
    (parser as unknown as { error: null; resume(): void }).error = null;
    (parser as unknown as { resume(): void }).resume();
  };

  try {
    parser.write(xml).close();
  } catch {
    // ignore residual parser errors after close
  }

  return { transactions, rawCount };
}

// Fetches the full global Poland residential transaction dataset from WFS.
// The server ignores teryt/city/bbox filters — city assignment is done via spatial join.
export async function fetchAllTransactions(): Promise<RcnTransaction[]> {
  CUTOFF_DATE = getCutoffDate();
  console.log(`Fetching WFS data (global Poland dataset), cutoff: ${CUTOFF_DATE.toISOString().slice(0, 10)}...`);

  const allTransactions: RcnTransaction[] = [];
  let startIndex = 0;

  while (true) {
    const url = buildUrl(startIndex);
    console.log(`  Page startIndex=${startIndex}...`);

    try {
      const { transactions, rawCount } = await fetchPage(url);
      allTransactions.push(...transactions);
      console.log(`  Got ${rawCount} raw features, ${transactions.length} within cutoff date`);

      if (rawCount < PAGE_SIZE) break; // last page

      startIndex += PAGE_SIZE;
      const maxPages = process.env.RCN_MAX_PAGES ? parseInt(process.env.RCN_MAX_PAGES) : Infinity;
      if (startIndex / PAGE_SIZE >= maxPages) {
        console.log(`  Stopped early (RCN_MAX_PAGES=${maxPages})`);
        break;
      }
    } catch (err) {
      console.error(`  Error fetching page at startIndex=${startIndex}:`, err);
      break;
    }
  }

  console.log(`Total: ${allTransactions.length} valid transactions fetched`);
  return allTransactions;
}
