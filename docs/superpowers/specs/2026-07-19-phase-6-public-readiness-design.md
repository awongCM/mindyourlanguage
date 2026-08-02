# Phase 6 — Public Readiness

**Date:** 2026-07-19  
**Status:** Approved  
**Author:** awongCM + Cursor Agent  
**Parent spec:** `docs/superpowers/specs/2026-07-13-mindyourlanguage-v2-design.md`  
**Parent plan:** `docs/superpowers/plans/2026-07-13-mindyourlanguage-v2.md` (Tasks 14–15)  
**Depends on:** Phases 0–5 shipped; Postgres provisioned in Phase 4 Blueprint  
**Prior phase:** Phase 5 — production practice (client-first; SRS + phrasebook in `localStorage`)

---

## 1. Intent

Phases 0–4 delivered a deployable personal MVP. Phase 5 adds productive practice (try-first, drill, SRS). Phase 6 is the **public launch** gate:

> OAuth login → cloud sync for history + phrasebook + SRS → rate limits → optional STT input

The founder can practice solo on Render today; Phase 6 unlocks intermediate learners with multi-device sync and cost controls.

### Relationship to Phase 5

Phase 5 ships **before** Phase 6 and keeps all practice data in `localStorage`. Phase 6 migrates phrasebook, history, and SRS progress to Postgres when `userId` is present — without breaking anonymous/local-only use.

---

## 2. Scope

### In scope

| Item | Delivers |
|---|---|
| **OAuth** | NextAuth.js with Google provider; login button in header |
| **Cloud sync** | History + phrasebook + SRS stats sync to Postgres when authenticated |
| **`GET\|POST /api/history`** | Server-backed history API (deferred from Phase 4) |
| **Rate limits** | Per-user limits on translate + check-attempt to prevent API cost overrun |
| **STT input** (optional) | Speech-to-text for "speak your attempt" in try-first mode |
| **Onboarding** | Intermediate learner completes setup in &lt; 2 minutes |

### Out of scope

- Monetization / paid tiers
- Custom domain (optional later)
- Pronunciation scoring (parent spec non-goal)

### Parent plan mapping

| Parent plan item | Phase 6 deliverable |
|---|---|
| Task 14 — OAuth + cloud sync | NextAuth, `lib/db.ts`, history store migration |
| Task 15 — Native alternative | **Already shipped** in Phase 2 PR 2b |

---

## 3. Success criteria

- [ ] Intermediate learner completes onboarding in &lt; 2 minutes
- [ ] Auth syncs phrasebook and SRS progress across devices
- [ ] Rate limits prevent API cost overrun
- [ ] Local-only mode still works when not logged in
- [ ] `DATABASE_URL` used at runtime (not just wired in Blueprint)

---

## 4. Approval record

| Reviewer | Status | Date |
|---|---|---|
| awongCM | Approved | 2026-07-19 |
