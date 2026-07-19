# Phase 6 Production Practice Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or executing-plans to implement task-by-task.

**Goal:** Ship Phase 6 — production practice for intermediate Mandarin learners: try-first translate, check attempt, phrasebook drill with SRS, shadowing, and sandhi pinyin.

**Architecture:** Client-first. Extends `PhrasebookEntry` with `PracticeStats`. New `/practice` route. Optional `POST /api/practice/check` (OpenAI). Sandhi computed in `lib/pinyin-sandhi.ts`. Shadowing extends `lib/speech.ts`.

**Tech Stack:** Next.js App Router, TypeScript, Zustand, Web Speech API, Vitest, Playwright.

**Design spec:** `docs/superpowers/specs/2026-07-19-phase-6-production-practice-design.md`

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

- [ ] Add `ReviewGrade`, `PracticeStats`, `CheckAttemptRequest/Response` to `packages/shared/src/types.ts`
- [ ] Add `spokenPinyin?: string` to `TranslateResponse`
- [ ] Create `apps/web/lib/practice/srs.ts` with `createInitialPracticeStats`, `recordReview`, `getDueEntries`, `isDue`
- [ ] Add `srs.test.ts`

---

## Task 2: Sandhi pinyin

- [ ] Create `pinyin-sandhi.ts` with `toSpokenPinyin(text)`
- [ ] Integrate into `enrich-translation.ts`
- [ ] Update `result-card.tsx` to show syllable + spoken pinyin
- [ ] Add tests

---

## Task 3: Try first + comparison

- [ ] Create `try-first-panel.tsx` with localStorage persist
- [ ] Create `comparison-panel.tsx`
- [ ] Wire `page.tsx` state: `userAttempt`, `tryFirstEnabled`

---

## Task 4: Check attempt API

- [ ] Create `check-attempt.ts` + route
- [ ] Wire button in `comparison-panel.tsx`
- [ ] Add route test

---

## Task 5: Shadowing

- [ ] Extend `speakChinese(text, region, { rate })`
- [ ] Add `speakSegments(segments, region, options)`
- [ ] Create `shadowing-player.tsx`
- [ ] Add to result-card and comparison panel

---

## Task 6: Practice page + phrasebook SRS

- [ ] Extend phrasebook store with `recordReview`, `getDueCount`
- [ ] Create `practice-drill-card.tsx`
- [ ] Create `app/practice/page.tsx`
- [ ] Add Practice header link on main page + practice page

---

## Task 7: E2E + README

- [ ] Add `e2e/practice.spec.ts`
- [ ] Update README Phase 6 section
- [ ] Run vitest + e2e

---

## Execution order

| Task | PR | Depends on |
|---|---|---|
| 1 Types + SRS | 6f | — |
| 2 Sandhi | 6e | — |
| 3 Try first | 6a | — |
| 4 Check attempt | 6b | 3 |
| 5 Shadowing | 6d | — |
| 6 Practice page | 6c + 6f | 1, 5 |
| 7 E2E + docs | — | all |
