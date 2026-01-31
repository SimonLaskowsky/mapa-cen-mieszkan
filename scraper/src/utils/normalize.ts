/**
 * Normalize district name to match database format
 */
export function normalizeDistrict(name: string, mappings: Map<string, string>): string | null {
  if (!name) return null;

  // Clean up the name
  const cleaned = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics

  // Try exact match
  if (mappings.has(cleaned)) {
    return mappings.get(cleaned)!;
  }

  // Try with spaces instead of dashes
  const withSpaces = cleaned.replace(/-/g, ' ');
  if (mappings.has(withSpaces)) {
    return mappings.get(withSpaces)!;
  }

  // Try partial match (district name contains the searched term)
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

  // Remove currency symbols, spaces, and non-numeric characters except comma/dot
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

  // Extract number, handling both comma and dot as decimal separators
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
