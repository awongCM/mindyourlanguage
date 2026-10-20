-- Phrasebook rows carry their own text since 002; translation_id is only a
-- client de-duplication key. The FK made history trims cascade-delete phrases
-- and rejected re-pushes of phrases whose translation had been trimmed.
ALTER TABLE phrasebook
  DROP CONSTRAINT IF EXISTS phrasebook_translation_id_fkey;
