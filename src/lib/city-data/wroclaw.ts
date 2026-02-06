// Wrocław district data

import rawGeoJSON from '@/data/wroclaw-districts.json';

export interface DistrictStats {
  district: string;
  offerType?: string;
  avgPrice?: number;
  avgPriceM2: number;
  medianPriceM2: number;
  listingCount: number;
  change30d: number;
  avgSize: number;
}

// Mock statistics for Wrocław osiedla (realistic 2025 prices)
// Prices based on typical Wrocław market: center ~16-18k, outskirts ~10-13k
export const DISTRICT_STATS: Record<string, DistrictStats> = {
  'Stare Miasto': { district: 'Stare Miasto', avgPriceM2: 18500, medianPriceM2: 17800, listingCount: 256, change30d: 0.6, avgSize: 48 },
  'Przedmieście Świdnickie': { district: 'Przedmieście Świdnickie', avgPriceM2: 16800, medianPriceM2: 16200, listingCount: 189, change30d: 1.2, avgSize: 52 },
  'Plac Grunwaldzki': { district: 'Plac Grunwaldzki', avgPriceM2: 15200, medianPriceM2: 14600, listingCount: 167, change30d: 0.8, avgSize: 50 },
  'Nadodrze': { district: 'Nadodrze', avgPriceM2: 14500, medianPriceM2: 14000, listingCount: 198, change30d: 2.4, avgSize: 54 },
  'Ołbin': { district: 'Ołbin', avgPriceM2: 14800, medianPriceM2: 14200, listingCount: 145, change30d: 1.8, avgSize: 52 },
  'Biskupin - Sępolno - Dąbie - Bartoszowice': { district: 'Biskupin-Sępolno', avgPriceM2: 16200, medianPriceM2: 15600, listingCount: 178, change30d: 0.4, avgSize: 58 },
  'Borek': { district: 'Borek', avgPriceM2: 15500, medianPriceM2: 15000, listingCount: 134, change30d: 1.1, avgSize: 55 },
  'Krzyki - Partynice': { district: 'Krzyki-Partynice', avgPriceM2: 15800, medianPriceM2: 15200, listingCount: 212, change30d: 0.9, avgSize: 54 },
  'Gaj': { district: 'Gaj', avgPriceM2: 14200, medianPriceM2: 13800, listingCount: 167, change30d: 1.5, avgSize: 52 },
  'Huby': { district: 'Huby', avgPriceM2: 14500, medianPriceM2: 14000, listingCount: 145, change30d: 1.3, avgSize: 50 },
  'Grabiszyn - Grabiszynek': { district: 'Grabiszyn', avgPriceM2: 14800, medianPriceM2: 14200, listingCount: 189, change30d: 1.6, avgSize: 53 },
  'Gajowice': { district: 'Gajowice', avgPriceM2: 13500, medianPriceM2: 13000, listingCount: 156, change30d: 2.0, avgSize: 51 },
  'Tarnogaj': { district: 'Tarnogaj', avgPriceM2: 13200, medianPriceM2: 12800, listingCount: 178, change30d: 2.2, avgSize: 52 },
  'Przedmiescie Oławskie': { district: 'Przedm. Oławskie', avgPriceM2: 13800, medianPriceM2: 13400, listingCount: 134, change30d: 1.9, avgSize: 50 },
  'Powstańców Ślaskich': { district: 'Powstańców Śl.', avgPriceM2: 13500, medianPriceM2: 13000, listingCount: 167, change30d: 1.7, avgSize: 52 },
  'Szczepin': { district: 'Szczepin', avgPriceM2: 12800, medianPriceM2: 12400, listingCount: 198, change30d: 2.5, avgSize: 48 },
  'Pilczyce - Kozanów - Popowice Płn.': { district: 'Pilczyce-Kozanów', avgPriceM2: 12200, medianPriceM2: 11800, listingCount: 234, change30d: 2.1, avgSize: 54 },
  'Gądów - Popowice Płd.': { district: 'Gądów-Popowice', avgPriceM2: 12500, medianPriceM2: 12000, listingCount: 189, change30d: 1.8, avgSize: 52 },
  'Karłowice - Różanka': { district: 'Karłowice-Różanka', avgPriceM2: 13800, medianPriceM2: 13400, listingCount: 145, change30d: 1.4, avgSize: 56 },
  'Kleczków': { district: 'Kleczków', avgPriceM2: 11800, medianPriceM2: 11400, listingCount: 167, change30d: 2.8, avgSize: 50 },
  'Kowale': { district: 'Kowale', avgPriceM2: 11200, medianPriceM2: 10800, listingCount: 134, change30d: 3.2, avgSize: 54 },
  'Osobowice - Rędzin': { district: 'Osobowice-Rędzin', avgPriceM2: 11500, medianPriceM2: 11000, listingCount: 98, change30d: 2.6, avgSize: 58 },
  'Psie Pole - Zawidawie': { district: 'Psie Pole', avgPriceM2: 11800, medianPriceM2: 11400, listingCount: 178, change30d: 2.4, avgSize: 55 },
  'Sołtysowice': { district: 'Sołtysowice', avgPriceM2: 11200, medianPriceM2: 10800, listingCount: 87, change30d: 3.0, avgSize: 52 },
  'Polanowice - Poswiętne - Ligota': { district: 'Polanowice', avgPriceM2: 10800, medianPriceM2: 10400, listingCount: 112, change30d: 3.5, avgSize: 56 },
  'Widawa': { district: 'Widawa', avgPriceM2: 10500, medianPriceM2: 10000, listingCount: 67, change30d: 3.8, avgSize: 60 },
  'Lipa Piotrowska': { district: 'Lipa Piotrowska', avgPriceM2: 11500, medianPriceM2: 11000, listingCount: 134, change30d: 2.2, avgSize: 58 },
  'Strachocin - Swojczyce - Wojnów': { district: 'Strachocin', avgPriceM2: 11200, medianPriceM2: 10800, listingCount: 98, change30d: 2.9, avgSize: 56 },
  'Brochów': { district: 'Brochów', avgPriceM2: 12800, medianPriceM2: 12400, listingCount: 145, change30d: 1.6, avgSize: 52 },
  'Jagodno': { district: 'Jagodno', avgPriceM2: 12500, medianPriceM2: 12000, listingCount: 256, change30d: 1.8, avgSize: 54 },
  'Wojszyce': { district: 'Wojszyce', avgPriceM2: 13200, medianPriceM2: 12800, listingCount: 189, change30d: 1.4, avgSize: 55 },
  'Ołtaszyn': { district: 'Ołtaszyn', avgPriceM2: 13500, medianPriceM2: 13000, listingCount: 167, change30d: 1.2, avgSize: 58 },
  'Klecina': { district: 'Klecina', avgPriceM2: 12800, medianPriceM2: 12400, listingCount: 145, change30d: 2.0, avgSize: 54 },
  'Księże': { district: 'Księże', avgPriceM2: 14200, medianPriceM2: 13800, listingCount: 123, change30d: 0.8, avgSize: 56 },
  'Zacisze - Zalesie - Szczytniki': { district: 'Zacisze-Szczytniki', avgPriceM2: 14500, medianPriceM2: 14000, listingCount: 134, change30d: 0.6, avgSize: 60 },
  'Maślice': { district: 'Maślice', avgPriceM2: 11800, medianPriceM2: 11400, listingCount: 112, change30d: 2.4, avgSize: 54 },
  'Leśnica': { district: 'Leśnica', avgPriceM2: 12200, medianPriceM2: 11800, listingCount: 156, change30d: 2.0, avgSize: 58 },
  'Żerniki': { district: 'Żerniki', avgPriceM2: 12500, medianPriceM2: 12000, listingCount: 134, change30d: 1.8, avgSize: 56 },
  'Jerzmanowo - Jarnołtów - Strachowice - Osiniec': { district: 'Jerzmanowo', avgPriceM2: 11500, medianPriceM2: 11000, listingCount: 89, change30d: 2.6, avgSize: 62 },
  'Muchobór Wielki': { district: 'Muchobór Wielki', avgPriceM2: 12800, medianPriceM2: 12400, listingCount: 178, change30d: 1.5, avgSize: 54 },
  'Muchobór Mały': { district: 'Muchobór Mały', avgPriceM2: 12500, medianPriceM2: 12000, listingCount: 145, change30d: 1.8, avgSize: 52 },
  'Kuźniki': { district: 'Kuźniki', avgPriceM2: 11800, medianPriceM2: 11400, listingCount: 98, change30d: 2.2, avgSize: 56 },
  'Oporów': { district: 'Oporów', avgPriceM2: 13200, medianPriceM2: 12800, listingCount: 156, change30d: 1.4, avgSize: 55 },
  'Nowy Dwór': { district: 'Nowy Dwór', avgPriceM2: 12200, medianPriceM2: 11800, listingCount: 134, change30d: 2.0, avgSize: 54 },
  'Pawłowice': { district: 'Pawłowice', avgPriceM2: 13500, medianPriceM2: 13000, listingCount: 145, change30d: 1.2, avgSize: 58 },
  'Pracze Odrzanskie': { district: 'Pracze Odrz.', avgPriceM2: 10800, medianPriceM2: 10400, listingCount: 67, change30d: 3.2, avgSize: 60 },
  'Świniary': { district: 'Świniary', avgPriceM2: 10500, medianPriceM2: 10000, listingCount: 45, change30d: 3.5, avgSize: 65 },
  'Bieńkowice': { district: 'Bieńkowice', avgPriceM2: 11200, medianPriceM2: 10800, listingCount: 78, change30d: 2.8, avgSize: 58 },
};

// District center points for markers (approximate centroids)
export interface DistrictCenter {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  stats: DistrictStats;
}

// Generate centers from GeoJSON (will be calculated dynamically)
// For now, using approximate centers for key districts
export const DISTRICT_CENTERS: DistrictCenter[] = Object.entries(DISTRICT_STATS).map(([name, stats]) => {
  // Approximate coordinates for Wrocław districts
  const coords: Record<string, [number, number]> = {
    'Stare Miasto': [51.1100, 17.0320],
    'Przedmieście Świdnickie': [51.1020, 17.0280],
    'Plac Grunwaldzki': [51.1120, 17.0580],
    'Nadodrze': [51.1180, 17.0380],
    'Ołbin': [51.1150, 17.0500],
    'Biskupin - Sępolno - Dąbie - Bartoszowice': [51.1050, 17.0850],
    'Borek': [51.0850, 17.0450],
    'Krzyki - Partynice': [51.0750, 17.0350],
    'Gaj': [51.0800, 17.0550],
    'Huby': [51.0900, 17.0480],
    'Grabiszyn - Grabiszynek': [51.0950, 17.0150],
    'Gajowice': [51.1000, 17.0050],
    'Tarnogaj': [51.0700, 17.0650],
    'Przedmiescie Oławskie': [51.0950, 17.0550],
    'Powstańców Ślaskich': [51.0850, 17.0250],
    'Szczepin': [51.1150, 16.9950],
    'Pilczyce - Kozanów - Popowice Płn.': [51.1350, 16.9650],
    'Gądów - Popowice Płd.': [51.1200, 16.9750],
    'Karłowice - Różanka': [51.1350, 17.0250],
    'Kleczków': [51.1280, 17.0650],
    'Kowale': [51.1450, 17.0550],
    'Osobowice - Rędzin': [51.1550, 17.0150],
    'Psie Pole - Zawidawie': [51.1480, 17.0750],
    'Sołtysowice': [51.1550, 17.0450],
    'Polanowice - Poswiętne - Ligota': [51.1650, 17.0350],
    'Widawa': [51.1750, 17.0550],
    'Lipa Piotrowska': [51.1580, 17.1050],
    'Strachocin - Swojczyce - Wojnów': [51.1350, 17.1250],
    'Brochów': [51.1200, 17.1050],
    'Jagodno': [51.0550, 17.0850],
    'Wojszyce': [51.0650, 17.0750],
    'Ołtaszyn': [51.0550, 17.0550],
    'Klecina': [51.0650, 17.0350],
    'Księże': [51.0750, 17.0150],
    'Zacisze - Zalesie - Szczytniki': [51.0950, 17.1050],
    'Maślice': [51.1350, 16.9350],
    'Leśnica': [51.1250, 16.8950],
    'Żerniki': [51.1050, 16.9450],
    'Jerzmanowo - Jarnołtów - Strachowice - Osiniec': [51.1050, 16.8650],
    'Muchobór Wielki': [51.0950, 16.9250],
    'Muchobór Mały': [51.0850, 16.9550],
    'Kuźniki': [51.0750, 16.9350],
    'Oporów': [51.0850, 16.9850],
    'Nowy Dwór': [51.0650, 16.9750],
    'Pawłowice': [51.0550, 17.0050],
    'Pracze Odrzanskie': [51.1650, 16.9550],
    'Świniary': [51.1750, 16.9350],
    'Bieńkowice': [51.0450, 17.0950],
  };

  const [lat, lng] = coords[name] || [51.11, 17.03];
  return {
    name,
    displayName: stats.district,
    lat,
    lng,
    stats,
  };
});

// Process raw GeoJSON
interface RawFeature {
  type: string;
  geometry: GeoJSON.Geometry;
  properties: {
    osiedle: string;
    id: number;
  };
}

const processedFeatures = (rawGeoJSON as { features: RawFeature[] }).features
  .map((f: RawFeature, index: number) => ({
    type: 'Feature' as const,
    id: index,
    geometry: f.geometry,
    properties: {
      name: f.properties.osiedle, // Normalize to 'name' for consistency
    },
  }));

export const DISTRICTS_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: processedFeatures,
};
