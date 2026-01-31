// City configuration for multi-city support

export interface CityConfig {
  id: string;
  name: string;
  nameShort: string;
  center: [number, number]; // [lng, lat]
  zoom: number;
  bounds: [[number, number], [number, number]]; // [[sw_lng, sw_lat], [ne_lng, ne_lat]]
  districtPropertyName: string; // Property name in GeoJSON for district name
}

export const CITIES: Record<string, CityConfig> = {
  warsaw: {
    id: 'warsaw',
    name: 'Warszawa',
    nameShort: 'WAW',
    center: [21.0, 52.23],
    zoom: 10.8,
    bounds: [[20.76, 52.09], [21.27, 52.37]],
    districtPropertyName: 'name',
  },
  krakow: {
    id: 'krakow',
    name: 'Kraków',
    nameShort: 'KRK',
    center: [19.945, 50.06],
    zoom: 11.5,
    bounds: [[19.79, 49.97], [20.22, 50.13]],
    districtPropertyName: 'name', // Will be processed to extract clean name
  },
  wroclaw: {
    id: 'wroclaw',
    name: 'Wrocław',
    nameShort: 'WRO',
    center: [17.03, 51.11],
    zoom: 11.5,
    bounds: [[16.87, 51.03], [17.18, 51.21]],
    districtPropertyName: 'osiedle',
  },
  katowice: {
    id: 'katowice',
    name: 'Katowice',
    nameShort: 'KTW',
    center: [19.02, 50.26],
    zoom: 11.5,
    bounds: [[18.9, 50.15], [19.15, 50.35]],
    districtPropertyName: 'name',
  },
};

export const CITY_ORDER = ['warsaw', 'krakow', 'wroclaw', 'katowice'];

// Check if a point is within a city's bounds
export function isPointInCity(lng: number, lat: number, city: CityConfig): boolean {
  const [[swLng, swLat], [neLng, neLat]] = city.bounds;
  return lng >= swLng && lng <= neLng && lat >= swLat && lat <= neLat;
}

// Find which city contains a point (if any)
export function findCityAtPoint(lng: number, lat: number): string | null {
  for (const cityId of CITY_ORDER) {
    if (isPointInCity(lng, lat, CITIES[cityId])) {
      return cityId;
    }
  }
  return null;
}
