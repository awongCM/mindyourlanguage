# Phase 6 — Neon cloud persistence

## 2026-09-26 — Merged PR #23 + sync hardening

**Shipped:** Neon-backed sync (history, phrasebook, review events), NextAuth Google OAuth (env-gated), `docs/neon-setup.md`, `render.yaml` without Render Postgres, local dev without Neon/Google (`NEXT_PUBLIC_GOOGLE_AUTH=false`).

**Critical fix (`b0d588b`):** `syncAllStores()` waits for Zustand persist rehydration (`wait-for-persist-hydration.ts`) before PUT/POST; empty phrasebook PUT no longer deletes all cloud rows; phrasebook merge uses `lastReviewedAt` for SRS; JWT clears `userId` if Neon provisioning fails; Playwright sets `NEXT_PUBLIC_GOOGLE_AUTH=true`.

**Deploy checklist (when owner is ready):**

1. Neon project (e.g. mindyourlanguage-db) — direct `DATABASE_URL` on Render + local.
2. `npm run db:migrate` once per database.
3. Google Cloud OAuth — redirect URIs: `http://localhost:3000/api/auth/callback/google` and `https://<render-host>/api/auth/callback/google`; match `AUTH_URL`.
4. Set `NEXT_PUBLIC_GOOGLE_AUTH=true` on Render (and local if testing sign-in).

**Tests:** Vitest passes without Neon/OAuth; Playwright sync-auth needs auth UI flag in webServer env.

**Open / backlog:** Docker Compose for local Postgres (deferred); sync API rate limits; sync only on login + “Sync now” (review follow-up I2).

## 2026-09-26 — Architecture note

| Data | Where |
|------|--------|
| Phrasebook/history/SRS (logged out) | Browser `localStorage` |
| Cloud sync | Neon + authenticated APIs |
| Dictionary | SQLite on Render disk |

Google OAuth does not integrate with Neon directly — app provisions `users` rows on sign-in and attaches sync to `session.user.id`.
