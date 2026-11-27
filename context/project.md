# Mind Your Language — Context

- **What it is:** Web app (Next.js) for intermediate Mandarin learners — translate, phrasebook, SRS practice, reliability tracking.
- **Who it's for:** Learners who want natural phrasing, not beginner drills.
- **Key differentiator:** Dictionary-grounded translation + practice loop (phrasebook, SRS, check attempts).
- **Current stage:** Phase 6 merged (Google OAuth path); anonymous Neon persistence ready on [PR #26](https://github.com/awongCM/mindyourlanguage/pull/26) (`feature/anonymous-neon-persistence`, migrations 001–004). Local-first default without `DATABASE_URL`. Scholarly Jade UI redesign on [PR #35](https://github.com/awongCM/mindyourlanguage/pull/35) (`feature/scholarly-jade-redesign`, see `context/scholarly-jade-redesign.md`).
- **Current goals:** Review/merge PR #35 (demo: https://mindyourlanguage-jade-demo.onrender.com); merge PR #26, deploy Render with Neon anonymous mode (see `docs/neon-setup.md` §8 and `context/anonymous-neon-persistence.md`); optional Google OAuth later.

## Positioning

Personal/solo learning tool; not a classroom LMS. Cloud sync is for multi-device backup when the owner opts in.

## Constraints

- **Render:** Web only in `render.yaml`; bind `0.0.0.0:$PORT`; ephemeral disk (CEDICT SQLite on build, not phrasebook).
- **Postgres:** Neon via `DATABASE_URL` (direct URL, `sslmode=require`); migrations via `npm run db:migrate` (not at build).
- **Local dev default:** `apps/web/.env.local` — `DEEPL_API_KEY` required for translate; `DATABASE_URL` and `AUTH_GOOGLE_*` empty; `NEXT_PUBLIC_GOOGLE_AUTH=false` hides sign-in.
- **Cloud identity:** Anonymous cookie sync is the intended production path for Render (no Google UI). Google session still wins over the cookie when OAuth env is set (Phase 6).
- **Migrate before `DATABASE_URL` on Render:** Apply 001–004 on Neon before the app talks to the DB (see `context/anonymous-neon-persistence.md`).
- **No repo Docker Postgres yet:** Ephemeral `docker run postgres:16-alpine` on 5433 was used once to prove migrations; not committed.

## Dev conventions (2026-11-28)

- Commands run from `apps/web`: `npm test` (Vitest), `npm run lint`, `npm run build`, e2e = `PLAYWRIGHT_BROWSERS_PATH=$HOME/Library/Caches/ms-playwright npm run test:e2e`.
- Lint baseline: 3 pre-existing `react-hooks/set-state-in-effect` errors + 1 unused-var warning — don't fix opportunistically, add none. New hydration setState needs a justified `eslint-disable-next-line` comment.
- Component tests: `renderToStaticMarkup` + `createElement`; glue/CSS via fs source-assertions (`readFileSync(new URL("./file", import.meta.url), "utf8")`).
- Files end with a trailing newline (recurring review finding — check before committing).
- Conventional commits (`feat(web): …`). Plans/specs in `docs/superpowers/{specs,plans}/YYYY-MM-DD-<name>.md`.
- Hydration: zustand persisted stores must start `false` on server AND first client render, flip in effect (`lib/stores/use-phrasebook-hydrated.ts` pattern). Never lazy `persist.hasHydrated()` initializers during render — causes hydration mismatch + e2e flakes.

## Owner preferences (2026-09-26)

- Defer Neon + Google until deployment phase; prove DB locally with Docker only when needed.
- Question raised whether OAuth scope matches intent — accepted Phase 6 spec bundle but wants minimum sufficient change; sync hardened in `b0d588b` (hydration before sync, no empty phrasebook wipe).
