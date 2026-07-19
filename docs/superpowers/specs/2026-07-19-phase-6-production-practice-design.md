# Phase 6 — Production Practice

**Date:** 2026-07-19  
**Status:** Approved  
**Author:** awongCM + Cursor Agent  
**Parent spec:** `docs/superpowers/specs/2026-07-13-mindyourlanguage-v2-design.md`  
**Depends on:** Phases 0–4 shipped; Phase 5 (OAuth/sync) optional — Phase 6 is client-first  
**Implementation plan:** `docs/superpowers/plans/2026-07-19-phase-6-production-practice.md`

---

## 1. Intent

Phases 0–4 delivered translate → ground → native alternative → hear → save. That loop is **receptive**: the app tells the user what to say. The founder's blocker is **productive fluency** — composing Mandarin sentences under speaking pressure, with tone confidence, without reaching for Google Translate.

Phase 6 closes the production loop:

> English thought → **try to say/write it yourself** → compare → **drill from phrasebook** → **shadow pronunciation** → **retain with spaced recall**

### Problem statement

| Symptom | Root cause | Phase 6 answer |
|---|---|---|
| Know ~3500 characters but can't speak fluidly | Recognition ≠ production | Try-first + check attempt |
| Wrong tones confuse listeners | Tones learned in isolation, not in sentences | Sandhi-aware pinyin + shadowing |
| Forgets phrases between sessions | No active recall on personal sentences | Phrasebook drill + lightweight SRS |
| Over-reliance on instant translation | No practice gate before reveal | Production-first translate mode |

### Relationship to Phase 5

Phase 5 adds OAuth, cloud sync, and STT **input**. Phase 6 ships **before** Phase 5:

- All Phase 6 MVP data stays in `localStorage` (extends existing phrasebook store).
- STT for "speak your attempt" is a **Phase 6 enhancement** if Phase 5 STT lands first; MVP uses typed Chinese attempt.
- Cloud sync of SRS progress waits for Phase 5 Postgres wiring.

---

## 2. Scope & sequencing

### In scope — six practice capabilities (sequenced PRs)

| PR | Feature | Delivers |
|---|---|---|
| **6a — Try first** | Production-first translate mode | User composes ZH attempt before reveal; side-by-side compare after translate |
| **6b — Check attempt** | `POST /api/practice/check` | LLM feedback on user's sentence vs model + native alternative (optional `OPENAI_API_KEY`) |
| **6c — Phrasebook drill** | `/practice` page | EN prompt → recall ZH → reveal → TTS; self-grade |
| **6d — Shadowing player** | Client shadowing controls | Slow/normal speed, segment loop, repeat-after-me using existing TTS |
| **6e — Tone sandhi pinyin** | Sandhi-aware display | Spoken pinyin alongside dictionary pinyin on results + practice views |
| **6f — Phrasebook SRS** | Lightweight spaced repetition | SM-2-lite scheduling on saved phrases; "Due today" queue in drill |

### Out of scope (deferred)

- Pronunciation **scoring** (acoustic analysis) — parent spec non-goal; shadowing + self-grade only
- Full spaced-repetition app (Anki replacement) — SRS limited to phrasebook entries
- Cantonese / other dialects
- Monetization
- Postgres persistence of drill stats until Phase 5 cloud sync

### Pipeline after Phase 6

```
EN source text
  → [Try first ON] user types ZH attempt (hidden from API until submit)
  → POST /api/translate (unchanged)
  → optional POST /api/practice/check (user attempt vs models)
  → show comparison: attempt | translation | native alternative
  → sandhi pinyin on all Chinese strings
  → shadowing player (segment / full / slow)
  → save to phrasebook → SRS schedules next review
  → /practice drills due + random phrasebook entries
```

---

## 3. PR 6a — Try first mode

- Toggle on main page (EN→ZH only): **"Try first"** (default off; persist in `localStorage` key `myl-try-first`).
- Additional textarea: "Your Mandarin attempt (optional)" before translate.
- After translate, show comparison when attempt is non-empty.

---

## 4. PR 6b — Check my attempt

`POST /api/practice/check` — LLM compares user attempt vs primary + native alternative. Requires `OPENAI_API_KEY`; button hidden when absent.

---

## 5. PR 6c — Phrasebook drill

`/practice` page with drill modes: Due today, All saved, Tagged filter. Flashcard flow: EN → reveal ZH → self-grade.

---

## 6. PR 6d — Shadowing player

Reusable component with Play full, Play slow (rate 0.75), Play segments. Used in result card, comparison, and drill views.

---

## 7. PR 6e — Tone sandhi pinyin

Rule-based sandhi for 不, 一, third-tone sequences. Display **Syllable pinyin** and **Spoken pinyin (sandhi)**.

---

## 8. PR 6f — Phrasebook SRS

`PracticeStats` on `PhrasebookEntry`. SM-2-lite scheduling via self-grade (Again / Hard / Good / Easy). Due queue on `/practice`.

---

## 9. Success criteria

- [ ] EN→ZH with Try first: user can write attempt, translate, see three-way compare
- [ ] Check attempt returns actionable feedback when `OPENAI_API_KEY` set
- [ ] `/practice` drills phrasebook with hide/reveal + self-grade
- [ ] Shadowing plays full, slow, and per-segment
- [ ] Spoken pinyin differs from syllable pinyin on sandhi examples
- [ ] SRS schedules reviews; "Due today" queue works after grading
- [ ] No regression to Phases 0–4 translate/TTS/phrasebook flows

---

## 10. Approval record

| Reviewer | Status | Date |
|---|---|---|
| awongCM | Approved | 2026-07-19 |
