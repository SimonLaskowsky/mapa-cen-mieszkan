import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import type { ScrapedListing } from './types.js';
import { stripPolish } from './utils/normalize.js';

// Load env from parent directory
dotenv.config({ path: '../.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function insertListings(listings: ScrapedListing[]): Promise<number> {
  if (listings.length === 0) return 0;

  const rows = listings.map((l) => ({
    external_id: l.externalId,
    source: l.source,
    city: l.city,
    district: l.district,
    address: l.address,
    lat: l.lat,
    lng: l.lng,
    price: l.price,
    size_m2: l.sizeM2,
    rooms: l.rooms,
    offer_type: l.offerType,
    url: l.url,
    title: l.title,
    thumbnail_url: l.thumbnailUrl,
    scraped_at: l.scrapedAt.toISOString(),
    description: l.description,
    floor: l.floor,
    building_year: l.buildingYear,
    building_type: l.buildingType,
    heating: l.heating,
    finish_condition: l.finishCondition,
    photos: l.photos,
  }));

  const { data, error } = await supabase
    .from('listings')
    .upsert(rows, {
      onConflict: 'external_id',
      ignoreDuplicates: false,
    })
    .select('id');

  if (error) {
    console.error('Error inserting listings:', error.message);
    return 0;
  }

  return data?.length || 0;
}

export async function getDistrictMappings(city: string): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('districts')
    .select('district')
    .eq('city', city);

  if (error) {
    console.error('Error fetching districts:', error.message);
    return new Map();
  }

  // Build a fuzzy-matching map. Keys are the different forms we might see
  // from scrapers (with Polish diacritics, without, etc.); values are the
  // canonical district string as stored in the DB.
  const map = new Map<string, string>();
  for (const row of data || []) {
    const canonical = (row as { district: string }).district;
    map.set(canonical.toLowerCase(), canonical);
    map.set(stripPolish(canonical.toLowerCase()), canonical);
  }

  return map;
}
