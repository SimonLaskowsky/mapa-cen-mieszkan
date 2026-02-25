-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry column to districts table
ALTER TABLE districts
  ADD COLUMN IF NOT EXISTS geom geometry(MultiPolygon, 4326);

-- Populate geom from existing JSONB geojson column
-- Handle both formats: full Feature (has 'geometry' key) or raw geometry
UPDATE districts
SET geom = ST_Multi(ST_SetSRID(
  ST_GeomFromGeoJSON(
    CASE WHEN geojson::jsonb ? 'geometry' THEN geojson::jsonb -> 'geometry'
         ELSE geojson::jsonb END
  ),
  4326
))
WHERE geojson IS NOT NULL AND geom IS NULL;

-- Create spatial index
CREATE INDEX IF NOT EXISTS idx_districts_geom ON districts USING GIST (geom);

-- RPC function: get districts intersecting a bounding box
-- Return types must match actual column types (DECIMAL = numeric in PG)
CREATE OR REPLACE FUNCTION get_districts_in_bbox(
  sw_lng double precision,
  sw_lat double precision,
  ne_lng double precision,
  ne_lat double precision
)
RETURNS TABLE (
  id uuid,
  city text,
  district text,
  center_lat numeric,
  center_lng numeric,
  geojson jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.city,
    d.district,
    d.center_lat,
    d.center_lng,
    d.geojson::jsonb
  FROM districts d
  WHERE d.geom IS NOT NULL
    AND ST_Intersects(
      d.geom,
      ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326)
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to refresh geometries from JSONB (for re-seeding)
-- Handles both formats: full Feature (has 'geometry' key) or raw geometry
CREATE OR REPLACE FUNCTION refresh_district_geometries()
RETURNS void AS $$
BEGIN
  UPDATE districts
  SET geom = ST_Multi(ST_SetSRID(
    ST_GeomFromGeoJSON(
      CASE WHEN geojson::jsonb ? 'geometry' THEN geojson::jsonb -> 'geometry'
           ELSE geojson::jsonb END
    ),
    4326
  ))
  WHERE geojson IS NOT NULL;
END;
$$ LANGUAGE plpgsql;
