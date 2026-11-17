-- Bite-size practice chunks: link clause cards to a full-paragraph parent.
ALTER TABLE phrasebook
  ADD COLUMN IF NOT EXISTS parent_id TEXT;

CREATE INDEX IF NOT EXISTS idx_phrasebook_parent_id
  ON phrasebook(parent_id)
  WHERE parent_id IS NOT NULL;