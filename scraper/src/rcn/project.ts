import proj4 from 'proj4';

// Polish national coordinate system used by geoportal.gov.pl
const EPSG2180 =
  '+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 ' +
  '+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';

const converter = proj4(EPSG2180, 'WGS84');

// WFS gml:pos is "northing easting" (Y X order in EPSG:2180)
// Test point: Kraków center ≈ northing 5550000, easting 649000 → ~50.06N, 19.94E
export function epsg2180toWGS84(northing: number, easting: number): { lat: number; lng: number } {
  // proj4.forward takes [X, Y] = [easting, northing] and returns [lng, lat]
  const [lng, lat] = converter.forward([easting, northing]);
  return { lat, lng };
}
