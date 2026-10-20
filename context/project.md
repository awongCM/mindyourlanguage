# Mind Your Language — Context

- **What it is:** Web app (Next.js) for intermediate Mandarin learners — translate, phrasebook, SRS practice, reliability tracking.
- **Who it's for:** Learners who want natural phrasing, not beginner drills.
- **Key differentiator:** Dictionary-grounded translation + practice loop (phrasebook, SRS, check attempts).
- **Current stage:** Phase 6 merged (Google OAuth path); anonymous Neon persistence ready on [PR #26](https://github.com/awongCM/mindyourlanguage/pull/26) (`feature/anonymous-neon-persistence`, migrations 001–004). Local-first default without `DATABASE_URL`.
- **Current goals:** Merge PR #26, deploy Render with Neon anonymous mode (see `docs/neon-setup.md` §8 and `context/anonymous-neon-persistence.md`); optional Google OAuth later.

## Positioning

Personal/solo learning tool; not a classroom LMS. Cloud sync is for multi-device backup when the owner opts in.

## Constraints

- **Render:** Web only in `render.yaml`; bind `0.0.0.0:$PORT`; ephemeral disk (CEDICT SQLite on build, not phrasebook).
- **Postgres:** Neon via `DATABASE_URL` (direct URL, `sslmode=require`); migrations via `npm run db:migrate` (not at build).
- **Local dev default:** `apps/web/.env.local` — `DEEPL_API_KEY` required for translate; `DATABASE_URL` and `AUTH_GOOGLE_*` empty; `NEXT_PUBLIC_GOOGLE_AUTH=false` hides sign-in.
- **Cloud identity:** Anonymous cookie sync is the intended production path for Render (no Google UI). Google session still wins over the cookie when OAuth env is set (Phase 6).
- **Migrate before `DATABASE_URL` on Render:** Apply 001–004 on Neon before the app talks to the DB (see `context/anonymous-neon-persistence.md`).
- **No repo Docker Postgres yet:** Ephemeral `docker run postgres:16-alpine` on 5433 was used once to prove migrations; not committed.

## Owner preferences (2026-09-26)

- Defer Neon + Google until deployment phase; prove DB locally with Docker only when needed.
- Question raised whether OAuth scope matches intent — accepted Phase 6 spec bundle but wants minimum sufficient change; sync hardened in `b0d588b` (hydration before sync, no empty phrasebook wipe).
