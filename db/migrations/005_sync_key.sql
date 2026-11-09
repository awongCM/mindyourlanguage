-- A sync phrase lets every browser open the same Neon user.
-- Only the SHA-256 hash is stored. The phrase itself stays in the myl_sync cookie.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sync_key_hash TEXT UNIQUE;
