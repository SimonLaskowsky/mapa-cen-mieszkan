export const WFS_CITIES = [
  { city: 'krakow',  teryt: '1261' },
  { city: 'wroclaw', teryt: '0264' },
  { city: 'gdansk',  teryt: '2261' },
  { city: 'poznan',  teryt: '3064' },
  { city: 'lodz',    teryt: '1061' },
];

// WFS service for RCN (Rejestr Cen Nieruchomości) on geoportal.gov.pl
// Warsaw (0146) is NOT in WFS — requires 363 MB GML ZIP parsing (deferred)
export const WFS_BASE_URL =
  'https://mapy.geoportal.gov.pl/wss/service/rcn';
