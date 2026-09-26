# Mind Your Language

A Mandarin fluency grounding tool for intermediate learners who want to translate and calibrate their phrasing — so they sound natural, not just correct.

**Status:** v2 Phases 0–5 shipped on `main`; Phase 5.5 reliability needle implemented on this branch. Next: Phase 6 (public readiness).

---

## Project intent

Mind Your Language helps people with solid intermediate Mandarin speaking and writing skills break through to natural fluency. The core workflow:

1. Enter a phrase, sentence, or short paragraph (English or Mandarin)
2. Get a translation enriched with pinyin, characters, and dictionary grounding
3. Hear pronunciation and revisit past translations while practicing

The goal is not beginner instruction — it is helping learners who are **stuck at intermediate level** sound like a fluent Mandarin speaker.

---

## Repository structure

```
mindyourlanguage/
├── README.md                          # This file
├── apps/
│   └── web/                           # Next.js App Router (v2)
├── packages/
│   ├── shared/                        # Shared TypeScript types
│   └── dictionary/                    # CC-CEDICT lookup (Phase 2)
├── db/
│   └── migrations/                    # Auth-ready Postgres schema
├── docs/
│   ├── neon-setup.md                  # Neon Postgres + migrations (Phase 6)
│   └── superpowers/
│       ├── specs/                     # v2 design spec
│       └── plans/                     # v2 implementation plan
└── archive/
    └── legacy-v1/                     # Original jQuery app (archived)
```

| Path | Description |
|---|---|
| `apps/web/` | Next.js frontend + API routes |
| `packages/shared/` | Shared translation domain types |
| `packages/dictionary/` | CEDICT package placeholder (filled in Phase 2) |
| `db/migrations/` | Postgres schema (nullable `user_id`) |
| `docs/neon-setup.md` | Neon project wiring, `DATABASE_URL`, OAuth, migrations |
| `docs/superpowers/specs/` | v2 design specification |
| `docs/superpowers/plans/` | v2 step-by-step implementation plan |
| `archive/legacy-v1/` | Archived v1 codebase (read-only reference) |

---

## Legacy archive

The original application (**Mandarin Phrase Translator Learner**) lived at the repository root as a jQuery 1.7 + Bootstrap 2 client-side web app. It has been moved to [`archive/legacy-v1/`](archive/legacy-v1/).

### Why it was archived

- Legacy stack (jQuery 1.7, Bootstrap 2, Underscore templates) is unmaintainable
- Client-side CEDICT parsing and hacked Google TTS are not viable for modern deployment
- API keys were exposed in client JavaScript
- No auth-ready architecture for future public use

The v1 code is preserved for historical reference and to inform v2 design decisions (CEDICT grounding, pinyin display, Chinese IME, TTS). It is **not** maintained.

See [`archive/legacy-v1/README.md`](archive/legacy-v1/README.md) for details on the original app and how to run it locally for reference.

---

## Mind Your Language v2

v2 is a greenfield rebuild documented in:

- **Parent design:** [`docs/superpowers/specs/2026-07-13-mindyourlanguage-v2-design.md`](docs/superpowers/specs/2026-07-13-mindyourlanguage-v2-design.md)
- **Parent plan:** [`docs/superpowers/plans/2026-07-13-mindyourlanguage-v2.md`](docs/superpowers/plans/2026-07-13-mindyourlanguage-v2.md)
- **Phase 3 (approved, shipped):** [`docs/superpowers/specs/2026-07-14-phase-3-tts-history-phrasebook-design.md`](docs/superpowers/specs/2026-07-14-phase-3-tts-history-phrasebook-design.md)
- **Phase 4 (approved, shipped):** [`docs/superpowers/specs/2026-07-15-phase-4-deploy-e2e-design.md`](docs/superpowers/specs/2026-07-15-phase-4-deploy-e2e-design.md) · [`docs/superpowers/plans/2026-07-15-phase-4-deploy-e2e.md`](docs/superpowers/plans/2026-07-15-phase-4-deploy-e2e.md)
- **Phase 5 (approved, shipped on main):** [`docs/superpowers/specs/2026-07-19-phase-5-production-practice-design.md`](docs/superpowers/specs/2026-07-19-phase-5-production-practice-design.md) · [`docs/superpowers/plans/2026-07-19-phase-5-production-practice.md`](docs/superpowers/plans/2026-07-19-phase-5-production-practice.md)
- **Phase 5.5 (approved):** [`docs/superpowers/specs/2026-08-06-phase-5.5-production-reliability-design.md`](docs/superpowers/specs/2026-08-06-phase-5.5-production-reliability-design.md) · [`docs/superpowers/plans/2026-08-06-phase-5.5-production-reliability.md`](docs/superpowers/plans/2026-08-06-phase-5.5-production-reliability.md)
- **Phase 6 (approved, next):** [`docs/superpowers/specs/2026-07-19-phase-6-public-readiness-design.md`](docs/superpowers/specs/2026-07-19-phase-6-public-readiness-design.md) — OAuth, cloud sync, public launch · **Setup:** [`docs/neon-setup.md`](docs/neon-setup.md)

### v2 highlights

| Feature | Details |
|---|---|
| Framework | Next.js 16 + TypeScript (App Router) |
| Translation | DeepL API (server-side) |
| Dictionary | CC-CEDICT in SQLite |
| Characters | 简体 / 繁體 toggle |
| TTS | Browser Web Speech API — Mainland (`zh-CN`) and Taiwan (`zh-TW`) |
| History / phrasebook | Local (`localStorage`) until Phase 6 cloud sync |
| Practice | Try-first translate, phrasebook drill, SRS, shadowing, sandhi pinyin, production reliability needle on `/practice` |
| Audience | Intermediate → fluent learners |
| Deploy | Render web service + Neon Postgres (Phase 6) |

**Phases 0–5.5 on `main`; Phase 6 (Neon + OAuth + sync) on this branch.**

### Run locally

Prerequisites: Node.js 20+, npm.

```bash
# 1. Install dependencies
npm ci

# 2. Import the dictionary (writes data/cedict.db)
npm run import-cedict
# Offline by default (repo 2013 CC-CEDICT fallback). To fetch the latest dump:
# CEDICT_FETCH=1 npm run import-cedict
# Delete data/cedict.txt first if a previous dump is already present.

# 3. Configure env
cp apps/web/.env.example apps/web/.env.local
# Required for translate: DEEPL_API_KEY
# Optional for native alternatives + check attempt: OPENAI_API_KEY
# Phase 6 cloud sync: see docs/neon-setup.md (DATABASE_URL, AUTH_*)

# 4. Start the app → http://localhost:3000
npm run dev
```

Without Phase 6 env vars, history and phrasebook stay in `localStorage`. For Neon + Google sign-in, follow **[Neon setup](docs/neon-setup.md)** (`npm run db:migrate`, then set `DATABASE_URL` and `AUTH_*` in `.env.local`).

### Local E2E

```bash
cd apps/web && npx playwright install chromium
npm run test:e2e -w apps/web   # from repo root; mocked APIs, no keys required
```

Playwright starts the dev server on **port 3001** by default so it does not collide with `npm run dev` on 3000. Override with `PLAYWRIGHT_PORT`.

### Mobile web (Option A)

The UI is a single-column layout tuned for phone browsers (Safari/Chrome). When logged out, data stays in that browser’s `localStorage`; sign in to sync phrasebook and practice across devices (Phase 6).

After deploy, smoke-test on a phone: translate → play audio → save → **History** restore → **Practice** reveal/grade. Design: [`docs/superpowers/specs/2026-09-23-mobile-web-option-a-design.md`](docs/superpowers/specs/2026-09-23-mobile-web-option-a-design.md). iOS TTS may need a second tap if audio is silent on first play.

### Deploy (Render)

Full Neon + OAuth steps: **[`docs/neon-setup.md`](docs/neon-setup.md)** (project **mindyourlanguage-db** or any Neon project name).

1. **Blueprint sync** — Connect this repo in the [Render Dashboard](https://dashboard.render.com/) and sync from [`render.yaml`](render.yaml). The Blueprint provisions the **web service only** (no Render Postgres).
2. **Neon** — Create or use a Neon project (Oregon region recommended). Apply migrations once: `export DATABASE_URL='…'` then `npm run db:migrate` (or `psql`; see the guide).
3. **Required secrets** — On Render, set `DEEPL_API_KEY`, `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (details in the Neon setup guide).
4. **Optional** — `OPENAI_API_KEY` for native-alternative suggestions (defaults to `gpt-5.6-luna` via `NATIVE_ALT_MODEL`).
5. **Build** — `buildCommand` in `render.yaml` is `npm ci --include=dev && npm run import-cedict && npm run build`. A root `.npmrc` also sets `include=dev` so Render’s Dashboard `npm ci` (with `NODE_ENV=production`) still installs TypeScript and CSS tooling. Update **Settings → Build Command** when you can so it matches the YAML. With `CEDICT_FETCH=1` the importer downloads the latest CC-CEDICT from MDBG; if that fetch fails it falls back to the repo archive.
6. **Free tier limits** — Free web services spin down after ~15 minutes of inactivity. Neon Free does not expire; compute scales to zero after ~5 minutes idle (first DB query after idle may cold-start).
7. **Health check** — Render uses [`/api/health`](apps/web/app/api/health/route.ts) (`healthCheckPath` in `render.yaml`). A healthy deploy returns `{ ok: true, cedict: true, deeplConfigured: true }` when CEDICT is imported and `DEEPL_API_KEY` is set. Health does **not** require `DATABASE_URL`.
8. **Monthly CEDICT refresh (only after the app is on Render)** — Skip this until the Blueprint has created the `mindyourlanguage` web service. There is no Deploy Hook until that service exists. Then: copy the hook from Render Dashboard → that web service → **Settings** → **Deploy Hook**, and store it as the GitHub Actions secret `RENDER_DEPLOY_HOOK_URL`. The workflow [`.github/workflows/refresh-cedict.yml`](.github/workflows/refresh-cedict.yml) POSTs that hook at 04:00 UTC on the 1st of each month (and via **Actions → Refresh CEDICT → Run workflow**). That rebuilds with `CEDICT_FETCH=1`. Do not append a `ref` query parameter; pinning a commit disables Render auto-deploys. Until Render is connected, local refresh is `CEDICT_FETCH=1 npm run import-cedict`.

---

## License

Dictionary data is [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) (CC BY-SA), published by MDBG. See individual component licenses within `archive/legacy-v1/` (e.g. Chinese IME LGPL, Font Awesome SIL).
