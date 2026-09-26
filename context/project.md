# Mind Your Language — Context

- **What it is:** Web app (Next.js) for intermediate Mandarin learners — translate, phrasebook, SRS practice, reliability tracking.
- **Who it's for:** Learners who want natural phrasing, not beginner drills.
- **Key differentiator:** Dictionary-grounded translation + practice loop (phrasebook, SRS, check attempts).
- **Current stage:** Phase 6 merged — optional Neon cloud sync + Google OAuth; local-first still default without env.
- **Current goals:** Deploy Render + Neon when ready; owner uses local translate + `localStorage` until OAuth/Neon configured.

## Positioning

Personal/solo learning tool; not a classroom LMS. Cloud sync is for multi-device backup when the owner opts in.

## Constraints

- **Render:** Web only in `render.yaml`; bind `0.0.0.0:$PORT`; ephemeral disk (CEDICT SQLite on build, not phrasebook).
- **Postgres:** Neon via `DATABASE_URL` (direct URL, `sslmode=require`); migrations via `npm run db:migrate` (not at build).
- **Local dev default:** `apps/web/.env.local` — `DEEPL_API_KEY` required for translate; `DATABASE_URL` and `AUTH_GOOGLE_*` empty; `NEXT_PUBLIC_GOOGLE_AUTH=false` hides sign-in.
- **OAuth is optional until configured:** Phase 6 ties cloud sync to signed-in users (Google); not required for translate/history/phrasebook in the browser.
- **No repo Docker Postgres yet:** Ephemeral `docker run postgres:16-alpine` on 5433 was used once to prove migrations; not committed.

## Owner preferences (2026-09-26)

- Defer Neon + Google until deployment phase; prove DB locally with Docker only when needed.
- Question raised whether OAuth scope matches intent — accepted Phase 6 spec bundle but wants minimum sufficient change; sync hardened in `b0d588b` (hydration before sync, no empty phrasebook wipe).
