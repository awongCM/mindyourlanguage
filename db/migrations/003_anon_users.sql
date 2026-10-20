-- Anonymous browser identity: SHA-256 hex of the myl_anon cookie token.
-- Google users keep using users.email; anonymous users leave it NULL.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS anon_token_hash TEXT UNIQUE;
