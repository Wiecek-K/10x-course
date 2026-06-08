-- Expand processing_status to expose individual pipeline stages for observability.
-- Old: pending | processing | done | failed
-- New: pending | scraping | describing | done | failed
--
-- 'processing' is removed; any rows stuck in that state are moved to 'failed'
-- (they were mid-flight when the consumer died and will never self-advance).

ALTER TABLE links DROP CONSTRAINT IF EXISTS links_processing_status_check;

UPDATE links SET processing_status = 'failed' WHERE processing_status = 'processing';

ALTER TABLE links ADD CONSTRAINT links_processing_status_check
  CHECK (processing_status IN ('pending', 'scraping', 'describing', 'done', 'failed'));
