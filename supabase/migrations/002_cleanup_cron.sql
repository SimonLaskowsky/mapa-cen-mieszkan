-- ============================================
-- Scheduled cleanup job for old listings
-- Run this in Supabase SQL Editor after enabling pg_cron
-- ============================================

-- Note: pg_cron must be enabled in Supabase Dashboard:
-- Database > Extensions > pg_cron

-- Schedule cleanup of listings older than 30 days
-- Runs daily at 3:00 AM UTC
SELECT cron.schedule(
  'cleanup-old-listings',
  '0 3 * * *',
  $$DELETE FROM listings WHERE scraped_at < NOW() - INTERVAL '30 days'$$
);

-- To check scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule:
-- SELECT cron.unschedule('cleanup-old-listings');
