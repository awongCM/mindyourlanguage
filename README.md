# Mind Your Language

A Mandarin fluency grounding tool for intermediate learners who want to translate and calibrate their phrasing — so they sound natural, not just correct.

**Status:** v2 in planning. Legacy v1 has been archived.

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

## Mind Your Language v2 (in progress)

v2 is a greenfield rebuild documented in:

- **Design spec:** [`docs/superpowers/specs/2026-07-13-mindyourlanguage-v2-design.md`](docs/superpowers/specs/2026-07-13-mindyourlanguage-v2-design.md)
- **Implementation plan:** [`docs/superpowers/plans/2026-07-13-mindyourlanguage-v2.md`](docs/superpowers/plans/2026-07-13-mindyourlanguage-v2.md)

### v2 highlights

| Feature | Details |
|---|---|
| Framework | Next.js 16 + TypeScript (App Router) |
| Translation | DeepL API (server-side) |
| Dictionary | CC-CEDICT in SQLite |
| Characters | 简体 / 繁體 toggle |
| TTS | Azure Neural TTS — Mainland (`zh-CN`) and Taiwan (`zh-TW`) voices |
| Audience | Intermediate → fluent learners |
| Deploy | Render Web Service + PostgreSQL |

**Phase 0 (foundation) is in progress** on branch `cursor/phase-0-foundation-7d72`: monorepo scaffold, shared types, Postgres schema, and shadcn base layout with character/voice toggles.

---

## License

See individual component licenses within `archive/legacy-v1/` (e.g. Chinese IME LGPL, Font Awesome SIL).
