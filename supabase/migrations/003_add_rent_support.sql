-- ============================================
-- Add rent support to district_stats
-- ============================================

-- Add offer_type column to district_stats
ALTER TABLE district_stats
ADD COLUMN offer_type TEXT NOT NULL DEFAULT 'sale' CHECK (offer_type IN ('sale', 'rent'));

-- Add avg_price column (total price, not per m²)
ALTER TABLE district_stats
ADD COLUMN avg_price DECIMAL;

-- Drop old unique constraint
ALTER TABLE district_stats
DROP CONSTRAINT district_stats_city_district_date_key;

-- Add new unique constraint including offer_type
ALTER TABLE district_stats
ADD CONSTRAINT district_stats_city_district_date_offer_type_key
UNIQUE(city, district, date, offer_type);

-- Add index for offer_type filtering
CREATE INDEX idx_district_stats_offer_type ON district_stats(offer_type);

-- Add index for combined queries
CREATE INDEX idx_district_stats_city_district_offer_type_date
ON district_stats(city, district, offer_type, date DESC);

-- ============================================
-- Update views to include offer_type
-- ============================================

-- Drop and recreate latest_district_stats view
DROP VIEW IF EXISTS latest_district_stats;

CREATE VIEW latest_district_stats AS
SELECT DISTINCT ON (city, district, offer_type)
  id,
  city,
  district,
  offer_type,
  date,
  avg_price,
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
ORDER BY city, district, offer_type, date DESC;

-- Drop and recreate price change view
DROP VIEW IF EXISTS district_price_changes;

CREATE VIEW district_price_changes AS
WITH current_stats AS (
  SELECT DISTINCT ON (city, district, offer_type)
    city,
    district,
    offer_type,
    date as current_date,
    avg_price_m2 as current_price,
    avg_price as current_total_price
  FROM district_stats
  ORDER BY city, district, offer_type, date DESC
),
previous_stats AS (
  SELECT DISTINCT ON (city, district, offer_type)
    city,
    district,
    offer_type,
    avg_price_m2 as previous_price,
    avg_price as previous_total_price
  FROM district_stats
  WHERE date <= CURRENT_DATE - INTERVAL '30 days'
  ORDER BY city, district, offer_type, date DESC
)
SELECT
  c.city,
  c.district,
  c.offer_type,
  c.current_price,
  c.current_total_price,
  p.previous_price,
  p.previous_total_price,
  CASE
    WHEN p.previous_price > 0
    THEN ROUND(((c.current_price - p.previous_price) / p.previous_price * 100)::numeric, 2)
    ELSE NULL
  END as change_percent_30d,
  CASE
    WHEN p.previous_total_price > 0
    THEN ROUND(((c.current_total_price - p.previous_total_price) / p.previous_total_price * 100)::numeric, 2)
    ELSE NULL
  END as total_price_change_percent_30d
FROM current_stats c
LEFT JOIN previous_stats p
  ON c.city = p.city
  AND c.district = p.district
  AND c.offer_type = p.offer_type;

-- ============================================
-- Add offer_type index to listings
-- ============================================
CREATE INDEX IF NOT EXISTS idx_listings_offer_type ON listings(offer_type);
CREATE INDEX IF NOT EXISTS idx_listings_city_district_offer_type
ON listings(city, district, offer_type);
