# Anonymous Neon persistence

## 2026-10-20 — Shipped on PR #26 (`feature/anonymous-neon-persistence`)

**What:** Each browser gets an httpOnly `myl_anon` cookie; Neon stores only `users.anon_token_hash` (migration 003). History, phrasebook, and review events sync without Google sign-in. Page restores the newest translation on refresh (works from `localStorage` even when sync returns 501).

**Owner preference:** Use Neon (per-project free DBs), not Render persistent disk or Render Postgres, for cloud backup on the deployed app.

**Docs:** Spec/plan under `docs/superpowers/`; operator steps in `docs/neon-setup.md` §8.

**Deploy order (critical):**

1. Run migrations **001–004** on Neon (`npm run db:migrate`) **before** pointing Render at the database.
2. **003** adds `anon_token_hash`; without it sync 503s.
3. **004** drops `phrasebook_translation_id_fkey` — without it, history trim at 50 rows cascade-deletes phrasebook rows and later phrasebook PUTs fail permanently.

**Sync semantics (for debugging):**

- GET with no cookie: empty list, no user created.
- Pushes send explicit `deletedIds` only for rows the server already showed this browser (`lastServerIds`); never “delete absent from client list.”
- Background sync: pull on load, 2 s debounced quiet push; never push before a successful pull; changes during the first pull use a dirty flag.
- Merged review events capped at 1,000 client-side (`mergeReviewEvents`) so POST cannot 413-loop (`d22e984`).
- Payload caps in `apps/web/lib/sync/limits.ts` (5 MB body, per-route counts, 2k phrases/user, 5k review events server trim).

**CI / PR checks:** GitHub Actions does not run unit/e2e on PRs; only `security/snyk` gates PR #26. `neon-db-migrate.yml` runs on push to `main` (needs `DATABASE_URL` secret).

**Local e2e:** Playwright `webServer` sets `DATABASE_URL: ''`. Chromium may live at `~/Library/Caches/ms-playwright` — use `PLAYWRIGHT_BROWSERS_PATH=$HOME/Library/Caches/ms-playwright`. Sandbox blocks Next dev server; run e2e outside sandbox.

**Known gaps (accepted for v1):**

- Delete then reload within ~2 s debounce may restore the row (no persisted tombstones).
- Stale second tab can re-upsert rows another tab deleted (no `storage` rehydrate on persist).
- Full-list push on every sync (cost grows with data).
- Anonymous user-creation rate limit uses leftmost `X-Forwarded-For` — verify Render/Cloudflare headers before trusting it.
- Google sign-in path (`auth-header-actions.tsx`) still auto-pushes on session load without pull first (out of scope for anonymous PR; can overwrite newer `practiceStats` from another device).

**Pre-existing lint (untouched):** `components/onboarding-sync-hint.tsx`, `components/try-first-panel.tsx` — `react-hooks/set-state-in-effect`.

**Post-merge smoke:** Spec acceptance + neon-setup §8 verify queries; phrase survives 55 translations + reload; delete waits 3 s before reload.
