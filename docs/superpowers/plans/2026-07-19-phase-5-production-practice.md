# Phase 5 Production Practice Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or executing-plans to implement task-by-task.

**Goal:** Ship Phase 5 — production practice for intermediate Mandarin learners: try-first translate, check attempt, phrasebook drill with SRS, shadowing, and sandhi pinyin.

**Architecture:** Client-first. Extends `PhrasebookEntry` with `PracticeStats`. New `/practice` route. Optional `POST /api/practice/check` (OpenAI). Sandhi computed in `lib/pinyin-sandhi.ts`. Shadowing extends `lib/speech.ts`.

**Tech Stack:** Next.js App Router, TypeScript, Zustand, Web Speech API, Vitest, Playwright.

**Design spec:** `docs/superpowers/specs/2026-07-19-phase-5-production-practice-design.md`

---

## File map

| File | Responsibility |
|---|---|
| `packages/shared/src/types.ts` | `PracticeStats`, `ReviewGrade`, check attempt types, `spokenPinyin` |
| `apps/web/lib/practice/srs.ts` | SM-2-lite scheduling |
| `apps/web/lib/practice/srs.test.ts` | SRS unit tests |
| `apps/web/lib/practice/check-attempt.ts` | OpenAI check attempt helper |
| `apps/web/lib/practice/check-attempt.test.ts` | Parser tests |
| `apps/web/app/api/practice/check/route.ts` | Check attempt API |
| `apps/web/lib/pinyin-sandhi.ts` | Tone sandhi rules |
| `apps/web/lib/pinyin-sandhi.test.ts` | Sandhi tests |
| `apps/web/lib/enrich-translation.ts` | Add `spokenPinyin` |
| `apps/web/lib/speech.ts` | Rate + segment speaking |
| `apps/web/lib/stores/phrasebook.ts` | SRS helpers + `recordReview` |
| `apps/web/lib/stores/phrasebook.test.ts` | SRS store tests |
| `apps/web/components/try-first-panel.tsx` | Attempt textarea |
| `apps/web/components/comparison-panel.tsx` | Three-way compare + check |
| `apps/web/components/shadowing-player.tsx` | Shadowing controls |
| `apps/web/components/practice-drill-card.tsx` | Drill flashcard |
| `apps/web/app/practice/page.tsx` | Practice page |
| `apps/web/app/page.tsx` | Wire try-first + comparison |
| `apps/web/components/result-card.tsx` | Sandhi pinyin + shadowing |
| `apps/web/e2e/practice.spec.ts` | E2E practice flows |

---

## Task 1: Shared types + SRS

- [x] Add `ReviewGrade`, `PracticeStats`, `CheckAttemptRequest/Response` to `packages/shared/src/types.ts`
- [x] Add `spokenPinyin?: string` to `TranslateResponse`
- [x] Create `apps/web/lib/practice/srs.ts` with `createInitialPracticeStats`, `recordReview`, `getDueEntries`, `isDue`
- [x] Add `srs.test.ts`

---

## Task 2: Sandhi pinyin

- [x] Create `pinyin-sandhi.ts` with `toSpokenPinyin(text)`
- [x] Integrate into `enrich-translation.ts`
- [x] Update `result-card.tsx` to show syllable + spoken pinyin
- [x] Add tests

---

## Task 3: Try first + comparison

- [x] Create `try-first-panel.tsx` with localStorage persist
- [x] Create `comparison-panel.tsx`
- [x] Wire `page.tsx` state: `userAttempt`, `tryFirstEnabled`

---

## Task 4: Check attempt API

- [x] Create `check-attempt.ts` + route
- [x] Wire button in `comparison-panel.tsx`
- [x] Add route test

---

## Task 5: Shadowing

- [x] Extend `speakChinese(text, region, { rate })`
- [x] Add `speakSegments(segments, region, options)`
- [x] Create `shadowing-player.tsx`
- [x] Add to result-card and comparison panel

---

## Task 6: Practice page + phrasebook SRS

- [x] Extend phrasebook store with `recordReview`, `getDueCount`
- [x] Create `practice-drill-card.tsx`
- [x] Create `app/practice/page.tsx`
- [x] Add Practice header link on main page + practice page

---

## Task 7: E2E + README

- [x] Add `e2e/practice.spec.ts`
- [x] Update README Phase 5 section
- [x] Run vitest + e2e

---

## Execution order

| Task | PR | Depends on |
|---|---|---|
| 1 Types + SRS | 5f | — |
| 2 Sandhi | 5e | — |
| 3 Try first | 5a | — |
| 4 Check attempt | 5b | 3 |
| 5 Shadowing | 5d | — |
| 6 Practice page | 5c + 5f | 1, 5 |
| 7 E2E + docs | — | all |
