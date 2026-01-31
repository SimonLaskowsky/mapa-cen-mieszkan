-- ============================================
-- Mapa Cen Mieszkań - Initial Database Schema
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table: districts (static, geo boundaries)
-- ============================================
CREATE TABLE districts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city TEXT NOT NULL,
  district TEXT NOT NULL,

  -- GeoJSON polygon of district boundaries
  geojson JSONB NOT NULL,

  -- Centroid for marker placement
  center_lat DECIMAL NOT NULL,
  center_lng DECIMAL NOT NULL,

  -- Optional metadata
  population INTEGER,
  area_km2 DECIMAL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(city, district)
);

CREATE INDEX idx_districts_city ON districts(city);

-- ============================================
-- Table: listings (temporary, 30 days retention)
-- ============================================
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT UNIQUE,
  source TEXT NOT NULL CHECK (source IN ('otodom', 'olx', 'morizon')),

  -- Location
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  address TEXT,
  lat DECIMAL,
  lng DECIMAL,

  -- Listing data
  price INTEGER NOT NULL CHECK (price > 0),
  size_m2 DECIMAL NOT NULL CHECK (size_m2 > 0),
  rooms INTEGER,
  price_per_m2 DECIMAL GENERATED ALWAYS AS (price / NULLIF(size_m2, 0)) STORED,

  -- Transaction type
  offer_type TEXT NOT NULL DEFAULT 'sale' CHECK (offer_type IN ('sale', 'rent')),

  -- Meta
  url TEXT NOT NULL,
  title TEXT,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_listings_city_district ON listings(city, district);
CREATE INDEX idx_listings_scraped_at ON listings(scraped_at);
CREATE INDEX idx_listings_source ON listings(source);
CREATE INDEX idx_listings_price_per_m2 ON listings(price_per_m2);

-- ============================================
-- Table: district_stats (permanent, aggregated)
-- ============================================
CREATE TABLE district_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  date DATE NOT NULL,

  -- Price per m² statistics
  avg_price_m2 DECIMAL,
  median_price_m2 DECIMAL,
  min_price_m2 DECIMAL,
  max_price_m2 DECIMAL,
  p10_price_m2 DECIMAL,
  p90_price_m2 DECIMAL,
  stddev_price_m2 DECIMAL,

  -- Volume
  listing_count INTEGER,
  new_listings INTEGER,

  -- Size
  avg_size_m2 DECIMAL,

  -- Room distribution
  count_1room INTEGER DEFAULT 0,
  count_2room INTEGER DEFAULT 0,
  count_3room INTEGER DEFAULT 0,
  count_4plus INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(city, district, date)
);

CREATE INDEX idx_district_stats_city_district_date ON district_stats(city, district, date DESC);
CREATE INDEX idx_district_stats_date ON district_stats(date DESC);

-- ============================================
-- Table: alerts (premium feature)
-- ============================================
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,

  -- Alert criteria
  city TEXT NOT NULL,
  district TEXT,
  max_price INTEGER,
  min_size_m2 DECIMAL,
  max_price_per_m2 DECIMAL,
  rooms INTEGER[],

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alerts_active ON alerts(is_active) WHERE is_active = true;
CREATE INDEX idx_alerts_user_email ON alerts(user_email);

-- ============================================
-- Function: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_districts_updated_at
  BEFORE UPDATE ON districts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- View: Latest district stats (for API)
-- ============================================
CREATE VIEW latest_district_stats AS
SELECT DISTINCT ON (city, district)
  id,
  city,
  district,
  date,
  avg_price_m2,
  median_price_m2,
  min_price_m2,
  max_price_m2,
  p10_price_m2,
  p90_price_m2,
  listing_count,
  new_listings,
  avg_size_m2,
  count_1room,
  count_2room,
  count_3room,
  count_4plus
FROM district_stats
ORDER BY city, district, date DESC;

-- ============================================
-- View: Price change (30 day comparison)
-- ============================================
CREATE VIEW district_price_changes AS
WITH current_stats AS (
  SELECT DISTINCT ON (city, district)
    city,
    district,
    date as current_date,
    avg_price_m2 as current_price
  FROM district_stats
  ORDER BY city, district, date DESC
),
previous_stats AS (
  SELECT DISTINCT ON (city, district)
    city,
    district,
    avg_price_m2 as previous_price
  FROM district_stats
  WHERE date <= CURRENT_DATE - INTERVAL '30 days'
  ORDER BY city, district, date DESC
)
SELECT
  c.city,
  c.district,
  c.current_price,
  p.previous_price,
  CASE
    WHEN p.previous_price > 0
    THEN ROUND(((c.current_price - p.previous_price) / p.previous_price * 100)::numeric, 2)
    ELSE NULL
  END as change_percent_30d
FROM current_stats c
LEFT JOIN previous_stats p ON c.city = p.city AND c.district = p.district;
