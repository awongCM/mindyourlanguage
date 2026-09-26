-- Phase 6: align Postgres with client stores (history, phrasebook, review events).

ALTER TABLE translations
  ADD COLUMN IF NOT EXISTS segments JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS native_note TEXT;

ALTER TABLE phrasebook
  ADD COLUMN IF NOT EXISTS source_text TEXT,
  ADD COLUMN IF NOT EXISTS source_lang TEXT CHECK (source_lang IN ('en', 'zh')),
  ADD COLUMN IF NOT EXISTS target_lang TEXT CHECK (target_lang IN ('en', 'zh')),
  ADD COLUMN IF NOT EXISTS translation TEXT,
  ADD COLUMN IF NOT EXISTS traditional TEXT,
  ADD COLUMN IF NOT EXISTS pinyin TEXT,
  ADD COLUMN IF NOT EXISTS character_set TEXT NOT NULL DEFAULT 'simplified',
  ADD COLUMN IF NOT EXISTS register TEXT CHECK (register IN ('formal', 'casual', 'neutral')),
  ADD COLUMN IF NOT EXISTS native_alternative TEXT,
  ADD COLUMN IF NOT EXISTS native_note TEXT,
  ADD COLUMN IF NOT EXISTS dictionary_matches JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS segments JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS practice_stats JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS review_events (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phrase_id       UUID NOT NULL,
  grade           TEXT NOT NULL CHECK (grade IN ('again', 'hard', 'good', 'easy')),
  reviewed_at     TIMESTAMPTZ NOT NULL,
  mode            TEXT NOT NULL DEFAULT 'self_grade',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_events_user_id ON review_events(user_id);
CREATE INDEX IF NOT EXISTS idx_review_events_user_reviewed ON review_events(user_id, reviewed_at DESC);
