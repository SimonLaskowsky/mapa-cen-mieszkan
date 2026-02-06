-- Add thumbnail_url column to listings table
ALTER TABLE listings ADD COLUMN thumbnail_url TEXT;

-- Create index for performance (optional, for queries filtering by thumbnail existence)
CREATE INDEX idx_listings_has_thumbnail ON listings(thumbnail_url) WHERE thumbnail_url IS NOT NULL;
