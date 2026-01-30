// Kraków district data

import rawGeoJSON from '@/data/krakow-districts.json';

export interface DistrictStats {
  district: string;
  avgPriceM2: number;
  medianPriceM2: number;
  listingCount: number;
  change30d: number;
  avgSize: number;
}

// Helper to get clean display name from full district name
export function getCleanDistrictName(fullName: string): string {
  // "Dzielnica VII Zwierzyniec" -> "Zwierzyniec"
  const match = fullName.match(/Dzielnica [IVXLCDM]+ (.+)/);
  return match ? match[1] : fullName;
}

// Mock statistics for Kraków districts (realistic 2025 prices)
export const DISTRICT_STATS: Record<string, DistrictStats> = {
  'Dzielnica I Stare Miasto': {
    district: 'Stare Miasto',
    avgPriceM2: 22500,
    medianPriceM2: 21800,
    listingCount: 287,
    change30d: 0.8,
    avgSize: 48,
  },
  'Dzielnica II Grzegórzki': {
    district: 'Grzegórzki',
    avgPriceM2: 18200,
    medianPriceM2: 17600,
    listingCount: 198,
    change30d: 1.4,
    avgSize: 52,
  },
  'Dzielnica III Prądnik Czerwony': {
    district: 'Prądnik Czerwony',
    avgPriceM2: 14800,
    medianPriceM2: 14200,
    listingCount: 234,
    change30d: 2.1,
    avgSize: 54,
  },
  'Dzielnica IV Prądnik Biały': {
    district: 'Prądnik Biały',
    avgPriceM2: 14200,
    medianPriceM2: 13800,
    listingCount: 312,
    change30d: 1.8,
    avgSize: 56,
  },
  'Dzielnica V Krowodrza': {
    district: 'Krowodrza',
    avgPriceM2: 16500,
    medianPriceM2: 16000,
    listingCount: 267,
    change30d: 0.5,
    avgSize: 50,
  },
  'Dzielnica VI Bronowice': {
    district: 'Bronowice',
    avgPriceM2: 15200,
    medianPriceM2: 14800,
    listingCount: 189,
    change30d: 1.2,
    avgSize: 55,
  },
  'Dzielnica VII Zwierzyniec': {
    district: 'Zwierzyniec',
    avgPriceM2: 17800,
    medianPriceM2: 17200,
    listingCount: 156,
    change30d: -0.3,
    avgSize: 58,
  },
  'Dzielnica VIII Dębniki': {
    district: 'Dębniki',
    avgPriceM2: 16200,
    medianPriceM2: 15600,
    listingCount: 278,
    change30d: 1.6,
    avgSize: 52,
  },
  'Dzielnica IX Łagiewniki-Borek Fałęcki': {
    district: 'Łagiewniki-Borek Fałęcki',
    avgPriceM2: 13800,
    medianPriceM2: 13400,
    listingCount: 145,
    change30d: 2.4,
    avgSize: 54,
  },
  'Dzielnica X Swoszowice': {
    district: 'Swoszowice',
    avgPriceM2: 12500,
    medianPriceM2: 12000,
    listingCount: 98,
    change30d: 3.1,
    avgSize: 62,
  },
  'Dzielnica XI Podgórze Duchackie': {
    district: 'Podgórze Duchackie',
    avgPriceM2: 14500,
    medianPriceM2: 14000,
    listingCount: 212,
    change30d: 1.9,
    avgSize: 53,
  },
  'Dzielnica XII Biezanow-Prokocim': {
    district: 'Bieżanów-Prokocim',
    avgPriceM2: 13200,
    medianPriceM2: 12800,
    listingCount: 245,
    change30d: 2.2,
    avgSize: 51,
  },
  'Dzielnica XIII Podgórze': {
    district: 'Podgórze',
    avgPriceM2: 15800,
    medianPriceM2: 15200,
    listingCount: 298,
    change30d: 0.9,
    avgSize: 49,
  },
  'Dzielnica XIV Czyżyny': {
    district: 'Czyżyny',
    avgPriceM2: 14100,
    medianPriceM2: 13600,
    listingCount: 189,
    change30d: 1.5,
    avgSize: 50,
  },
  'Dzielnica XV Mistrzejowice': {
    district: 'Mistrzejowice',
    avgPriceM2: 12800,
    medianPriceM2: 12400,
    listingCount: 167,
    change30d: 2.0,
    avgSize: 52,
  },
  'Dzielnica XVI Bieńczyce': {
    district: 'Bieńczyce',
    avgPriceM2: 11500,
    medianPriceM2: 11000,
    listingCount: 134,
    change30d: 2.8,
    avgSize: 48,
  },
  'Dzielnica XVII Wzgórza Krzeszławickie': {
    district: 'Wzgórza Krzeszławickie',
    avgPriceM2: 11800,
    medianPriceM2: 11400,
    listingCount: 87,
    change30d: 3.5,
    avgSize: 58,
  },
  'Dzielnica XVIII Nowa Huta': {
    district: 'Nowa Huta',
    avgPriceM2: 10800,
    medianPriceM2: 10400,
    listingCount: 312,
    change30d: 2.6,
    avgSize: 54,
  },
};

// District center points for markers (approximate)
export interface DistrictCenter {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  stats: DistrictStats;
}

export const DISTRICT_CENTERS: DistrictCenter[] = [
  { name: 'Dzielnica I Stare Miasto', displayName: 'Stare Miasto', lat: 50.0614, lng: 19.9372, stats: DISTRICT_STATS['Dzielnica I Stare Miasto'] },
  { name: 'Dzielnica II Grzegórzki', displayName: 'Grzegórzki', lat: 50.0580, lng: 19.9650, stats: DISTRICT_STATS['Dzielnica II Grzegórzki'] },
  { name: 'Dzielnica III Prądnik Czerwony', displayName: 'Prądnik Czerwony', lat: 50.0850, lng: 19.9550, stats: DISTRICT_STATS['Dzielnica III Prądnik Czerwony'] },
  { name: 'Dzielnica IV Prądnik Biały', displayName: 'Prądnik Biały', lat: 50.0950, lng: 19.9250, stats: DISTRICT_STATS['Dzielnica IV Prądnik Biały'] },
  { name: 'Dzielnica V Krowodrza', displayName: 'Krowodrza', lat: 50.0720, lng: 19.9150, stats: DISTRICT_STATS['Dzielnica V Krowodrza'] },
  { name: 'Dzielnica VI Bronowice', displayName: 'Bronowice', lat: 50.0780, lng: 19.8850, stats: DISTRICT_STATS['Dzielnica VI Bronowice'] },
  { name: 'Dzielnica VII Zwierzyniec', displayName: 'Zwierzyniec', lat: 50.0550, lng: 19.8750, stats: DISTRICT_STATS['Dzielnica VII Zwierzyniec'] },
  { name: 'Dzielnica VIII Dębniki', displayName: 'Dębniki', lat: 50.0380, lng: 19.9150, stats: DISTRICT_STATS['Dzielnica VIII Dębniki'] },
  { name: 'Dzielnica IX Łagiewniki-Borek Fałęcki', displayName: 'Łagiewniki', lat: 50.0180, lng: 19.9350, stats: DISTRICT_STATS['Dzielnica IX Łagiewniki-Borek Fałęcki'] },
  { name: 'Dzielnica X Swoszowice', displayName: 'Swoszowice', lat: 49.9950, lng: 19.9550, stats: DISTRICT_STATS['Dzielnica X Swoszowice'] },
  { name: 'Dzielnica XI Podgórze Duchackie', displayName: 'Podgórze Duchackie', lat: 50.0150, lng: 19.9750, stats: DISTRICT_STATS['Dzielnica XI Podgórze Duchackie'] },
  { name: 'Dzielnica XII Biezanow-Prokocim', displayName: 'Bieżanów-Prokocim', lat: 50.0080, lng: 20.0250, stats: DISTRICT_STATS['Dzielnica XII Biezanow-Prokocim'] },
  { name: 'Dzielnica XIII Podgórze', displayName: 'Podgórze', lat: 50.0420, lng: 19.9580, stats: DISTRICT_STATS['Dzielnica XIII Podgórze'] },
  { name: 'Dzielnica XIV Czyżyny', displayName: 'Czyżyny', lat: 50.0720, lng: 20.0150, stats: DISTRICT_STATS['Dzielnica XIV Czyżyny'] },
  { name: 'Dzielnica XV Mistrzejowice', displayName: 'Mistrzejowice', lat: 50.1050, lng: 20.0150, stats: DISTRICT_STATS['Dzielnica XV Mistrzejowice'] },
  { name: 'Dzielnica XVI Bieńczyce', displayName: 'Bieńczyce', lat: 50.0920, lng: 20.0450, stats: DISTRICT_STATS['Dzielnica XVI Bieńczyce'] },
  { name: 'Dzielnica XVII Wzgórza Krzeszławickie', displayName: 'Wzgórza Krzesł.', lat: 50.1050, lng: 20.0650, stats: DISTRICT_STATS['Dzielnica XVII Wzgórza Krzeszławickie'] },
  { name: 'Dzielnica XVIII Nowa Huta', displayName: 'Nowa Huta', lat: 50.0720, lng: 20.1050, stats: DISTRICT_STATS['Dzielnica XVIII Nowa Huta'] },
];

// Process raw GeoJSON
interface RawFeature {
  type: string;
  geometry: GeoJSON.Geometry;
  properties: {
    name: string;
    [key: string]: unknown;
  };
}

const processedFeatures = (rawGeoJSON as { features: RawFeature[] }).features
  .map((f: RawFeature, index: number) => ({
    type: 'Feature' as const,
    id: index,
    geometry: f.geometry,
    properties: {
      name: f.properties.name,
    },
  }));

export const DISTRICTS_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: processedFeatures,
};
