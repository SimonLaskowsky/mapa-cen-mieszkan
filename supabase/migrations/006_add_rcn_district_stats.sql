-- RCN (Rejestr Cen Nieruchomości) transaction price stats per district per month
-- Source: geoportal.gov.pl WFS (cities covered: Krakow, Wroclaw, Gdansk, Poznan, Lodz)
-- Warsaw requires a separate 363 MB GML ZIP parser (deferred)

CREATE TABLE IF NOT EXISTS rcn_district_stats (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city              TEXT NOT NULL,
  district          TEXT NOT NULL,
  month             DATE NOT NULL,          -- first day of month: '2025-11-01'
  median_price_m2   DECIMAL,
  avg_price_m2      DECIMAL,
  min_price_m2      DECIMAL,
  max_price_m2      DECIMAL,
  p10_price_m2      DECIMAL,
  p90_price_m2      DECIMAL,
  transaction_count INTEGER,
  count_primary     INTEGER DEFAULT 0,      -- rynek pierwotny
  count_secondary   INTEGER DEFAULT 0,      -- rynek wtorny
  source            TEXT NOT NULL DEFAULT 'wfs',
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(city, district, month)
);

CREATE INDEX IF NOT EXISTS idx_rcn_city_district ON rcn_district_stats(city, district, month DESC);

CREATE OR REPLACE VIEW latest_rcn_district_stats AS
SELECT DISTINCT ON (city, district)
  id, city, district, month,
  median_price_m2, avg_price_m2, min_price_m2, max_price_m2,
  p10_price_m2, p90_price_m2,
  transaction_count, count_primary, count_secondary, source
FROM rcn_district_stats
ORDER BY city, district, month DESC;
