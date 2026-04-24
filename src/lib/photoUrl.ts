// Morizon CDN size tokens. Actual dimensions verified against img1.staticmorizon.com.pl:
//   xs = 300x200, s = 450x300, m = 600x400, l = 900x600, xl = 1024x768
// Older scraped data is stored with _xs (blurry thumbnails) — rewrite at display time.
export type MorizonSize = 'xs' | 's' | 'm' | 'l' | 'xl';

const MORIZON_PREFIX = 'https://img1.staticmorizon.com.pl/thumb/';

// Backfill fix for a scraper bug where URLs lacked the size/filename suffix;
// the CDN responds with a 302 placeholder unless we append it.
export function normalizeMorizonPhoto(url: string): string {
  if (!url.startsWith(MORIZON_PREFIX)) return url;
  if (url.includes(':fill_and_crop/') || url.endsWith('.jpg')) return url;
  return `${url.replace(/\/$/, '')}/3x2_l:fill_and_crop/image.jpg`;
}

// Rewrite the size token in a Morizon CDN URL (passes other hosts through unchanged).
export function morizonPhotoAtSize(url: string, size: MorizonSize): string {
  if (!url.startsWith(MORIZON_PREFIX)) return url;
  const normalized = normalizeMorizonPhoto(url);
  return normalized.replace(/\/3x2_[a-z]+:fill_and_crop\//, `/3x2_${size}:fill_and_crop/`);
}
