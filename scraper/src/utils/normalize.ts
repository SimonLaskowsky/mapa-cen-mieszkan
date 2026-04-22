// Polish diacritics → ASCII. NFD decomposition does NOT handle ł/Ł (they are
// standalone Unicode code points, not base + combining mark), so we map them
// explicitly along with the rest for consistency across our DB (which already
// contains mixed forms like "białołeka", "praga-połnoc").
const POLISH_TO_ASCII: Record<string, string> = {
  ł: 'l', Ł: 'L',
  ą: 'a', Ą: 'A',
  ć: 'c', Ć: 'C',
  ę: 'e', Ę: 'E',
  ń: 'n', Ń: 'N',
  ó: 'o', Ó: 'O',
  ś: 's', Ś: 'S',
  ź: 'z', Ź: 'Z',
  ż: 'z', Ż: 'Z',
};

/**
 * Strip Polish diacritics (ł, ą, ć, ę, ń, ó, ś, ź, ż and their uppercase forms)
 * plus any remaining combining marks via NFD. Safe for slug comparison.
 */
export function stripPolish(s: string): string {
  return s
    .replace(/[łŁąĄćĆęĘńŃóÓśŚźŹżŻ]/g, (c) => POLISH_TO_ASCII[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Normalize district name to match database format
 */
export function normalizeDistrict(name: string, mappings: Map<string, string>): string | null {
  if (!name) return null;

  // Lowercase, trim, spaces→dashes, collapse runs of dashes (Otodom sometimes
  // produces "praga--poludnie" from its breadcrumbs).
  const cleaned = stripPolish(name.toLowerCase().trim())
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  if (mappings.has(cleaned)) {
    return mappings.get(cleaned)!;
  }

  const withSpaces = cleaned.replace(/-/g, ' ');
  if (mappings.has(withSpaces)) {
    return mappings.get(withSpaces)!;
  }

  for (const [key, value] of mappings) {
    if (key.includes(cleaned) || cleaned.includes(key)) {
      return value;
    }
  }

  return null;
}

/**
 * Parse price string to number
 */
export function parsePrice(priceStr: string): number | null {
  if (!priceStr) return null;

  const cleaned = priceStr
    .replace(/[^\d,.\s]/g, '')
    .replace(/\s/g, '')
    .replace(',', '.');

  const price = parseFloat(cleaned);
  return isNaN(price) ? null : Math.round(price);
}

/**
 * Parse size string to number
 */
export function parseSize(sizeStr: string): number | null {
  if (!sizeStr) return null;

  const match = sizeStr.match(/(\d+[,.]?\d*)/);
  if (!match) return null;

  const size = parseFloat(match[1].replace(',', '.'));
  return isNaN(size) ? null : size;
}

/**
 * Parse rooms string to number
 */
export function parseRooms(roomsStr: string): number | null {
  if (!roomsStr) return null;

  const match = roomsStr.match(/(\d+)/);
  if (!match) return null;

  const rooms = parseInt(match[1], 10);
  return isNaN(rooms) ? null : rooms;
}

/**
 * Extract external ID from Otodom URL
 */
export function extractOtodomId(url: string): string | null {
  // URLs like: https://www.otodom.pl/pl/oferta/mieszkanie-2-pokoje-ID12345
  const match = url.match(/ID(\w+)$/i) || url.match(/oferta\/[^/]+-(\w+)$/);
  return match ? `otodom-${match[1]}` : null;
}

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Random delay within range
 */
export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return delay(ms);
}
