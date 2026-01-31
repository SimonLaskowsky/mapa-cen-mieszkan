export interface ScrapedListing {
  externalId: string;
  source: 'otodom' | 'olx' | 'morizon';
  city: string;
  district: string;
  address?: string;
  lat?: number;
  lng?: number;
  price: number;
  sizeM2: number;
  rooms?: number;
  offerType: 'sale' | 'rent';
  url: string;
  title?: string;
  scrapedAt: Date;
}

export interface DistrictMapping {
  [key: string]: string; // raw name -> normalized name
}

export interface ScraperConfig {
  city: string;
  maxPages: number;
  delayMs: number;
  headless: boolean;
}

export interface AggregatedStats {
  city: string;
  district: string;
  date: string;
  avgPriceM2: number;
  medianPriceM2: number;
  minPriceM2: number;
  maxPriceM2: number;
  p10PriceM2: number;
  p90PriceM2: number;
  stddevPriceM2: number;
  listingCount: number;
  newListings: number;
  avgSizeM2: number;
  count1Room: number;
  count2Room: number;
  count3Room: number;
  count4Plus: number;
}
