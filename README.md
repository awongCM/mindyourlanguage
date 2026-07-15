# Mind Your Language

A Mandarin fluency grounding tool for intermediate learners who want to translate and calibrate their phrasing — so they sound natural, not just correct.

**Status:** v2 Phases 0–3 shipped on `main`. Phase 4 (Render deploy + Playwright E2E) design/plan ready. Legacy v1 archived.

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

## Mind Your Language v2 (Phase 4 in progress)

v2 is a greenfield rebuild documented in:

- **Parent design:** [`docs/superpowers/specs/2026-07-13-mindyourlanguage-v2-design.md`](docs/superpowers/specs/2026-07-13-mindyourlanguage-v2-design.md)
- **Parent plan:** [`docs/superpowers/plans/2026-07-13-mindyourlanguage-v2.md`](docs/superpowers/plans/2026-07-13-mindyourlanguage-v2.md)
- **Phase 3 (approved, shipped):** [`docs/superpowers/specs/2026-07-14-phase-3-tts-history-phrasebook-design.md`](docs/superpowers/specs/2026-07-14-phase-3-tts-history-phrasebook-design.md)
- **Phase 4 (design/plan):** [`docs/superpowers/specs/2026-07-15-phase-4-deploy-e2e-design.md`](docs/superpowers/specs/2026-07-15-phase-4-deploy-e2e-design.md) · [`docs/superpowers/plans/2026-07-15-phase-4-deploy-e2e.md`](docs/superpowers/plans/2026-07-15-phase-4-deploy-e2e.md)

### v2 highlights

| Feature | Details |
|---|---|
| Framework | Next.js 16 + TypeScript (App Router) |
| Translation | DeepL API (server-side) |
| Dictionary | CC-CEDICT in SQLite |
| Characters | 简体 / 繁體 toggle |
| TTS | Browser Web Speech API — Mainland (`zh-CN`) and Taiwan (`zh-TW`) |
| History / phrasebook | Local (`localStorage`) until Phase 5 cloud sync |
| Audience | Intermediate → fluent learners |
| Deploy | Render Web Service + PostgreSQL (Phase 4) |

**Phases 0–3 are shipped on `main`.** Phase 4 (in progress): Playwright E2E, deploy hardening — [`render.yaml`](render.yaml), `/api/health`, and CEDICT build import are in place.

### Deploy (Render)

1. **Blueprint sync** — Connect this repo in the [Render Dashboard](https://dashboard.render.com/) and sync from [`render.yaml`](render.yaml). Render provisions the web service and Postgres database from the Blueprint.
2. **Required secret** — Set `DEEPL_API_KEY` in the service environment (marked `sync: false` in the Blueprint so it is not overwritten on sync).
3. **Optional** — `OPENAI_API_KEY` for native-alternative suggestions (defaults to `gpt-4o-mini` via `NATIVE_ALT_MODEL`).
4. **Build** — `buildCommand` runs `npm ci`, `npm run import-cedict` (imports CC-CEDICT from the repo fallback text), then `npm run build`.
5. **Database migration** — After the Postgres instance is created, apply [`db/migrations/001_initial.sql`](db/migrations/001_initial.sql) once (e.g. via Render Shell or `psql` with the internal connection string).
6. **Free tier limits** — Free web services spin down after ~15 minutes of inactivity; free Postgres databases expire after ~30 days.
7. **Health check** — Render uses [`/api/health`](apps/web/app/api/health/route.ts) (`healthCheckPath` in `render.yaml`). A healthy deploy returns `{ ok: true, cedict: true, deeplConfigured: true }` when CEDICT is imported and `DEEPL_API_KEY` is set.

---

## License

See individual component licenses within `archive/legacy-v1/` (e.g. Chinese IME LGPL, Font Awesome SIL).
