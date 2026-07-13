-- Auth-ready schema: user_id is nullable until auth is wired up.
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS translations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id),
  source_text         TEXT NOT NULL,
  source_lang         TEXT NOT NULL CHECK (source_lang IN ('en', 'zh')),
  target_lang         TEXT NOT NULL CHECK (target_lang IN ('en', 'zh')),
  translation         TEXT NOT NULL,
  traditional         TEXT,
  pinyin              TEXT,
  character_set       TEXT NOT NULL DEFAULT 'simplified',
  native_alternative  TEXT,
  register            TEXT CHECK (register IN ('formal', 'casual', 'neutral')),
  dictionary_matches  JSONB NOT NULL DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS phrasebook (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  translation_id  UUID REFERENCES translations(id) ON DELETE CASCADE,
  tags            TEXT[] DEFAULT '{}',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_translations_user_id ON translations(user_id);
CREATE INDEX IF NOT EXISTS idx_translations_created_at ON translations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phrasebook_user_id ON phrasebook(user_id);
