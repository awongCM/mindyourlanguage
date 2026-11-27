# Render Jade Demo Service

## 2026-11-27 — Demo service for Scholarly Jade PR #35

Created so the owner can test the redesigned UI end-to-end without touching production.

- **Service:** `mindyourlanguage-jade-demo` — id `srv-dc4n7ad6e07s73fu1phg`, workspace `tea-cspsg1q3esus738fae4g` (Andy Wong's Workspace).
- **URL:** https://mindyourlanguage-jade-demo.onrender.com — free plan, **spins down after 15 min idle** (~30s cold start).
- **Branch:** `feature/scholarly-jade-redesign`, auto-deploy on push. Same build/start as prod (`npm ci --include=dev && npm run import-cedict && npm run build` / `npm run start`).
- **Env:** `DEEPL_API_KEY`, `OPENAI_API_KEY`, `NATIVE_ALT_MODEL=gpt-5.6-luna`, `RATE_LIMIT_PER_MIN=20`, `CEDICT_FETCH=1`, `NODE_ENV=production`, `AUTH_SECRET` (copied from `apps/web/.env.local`), `NEXT_PUBLIC_GOOGLE_AUTH=false`.
- **No `DATABASE_URL`:** `/api/phrasebook|history|review-events` return 501 "Cloud sync is not configured" — app falls back to localStorage. Expected, not a bug. To get shared-phrasebook parity, set the Neon URL + run migrations 001–004 first (see `context/anonymous-neon-persistence.md`).
- **Gotcha:** `AUTH_SECRET` must be set even with auth flag off — otherwise `/api/auth/session` 500s on every page load (NextAuth config error).

### Cleanup

Decide after PR #35 merges: delete the service (Render MCP `plugin-render-render`, or dashboard) — it exists only for pre-merge testing.
