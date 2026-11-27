# Scholarly Jade Redesign

## 2026-11-28 — PR #35 open, demo live on Render

Full UI redesign executed via subagent-driven development (SDD), 34 commits on `feature/scholarly-jade-redesign`.

- **PR:** [#35](https://github.com/awongCM/mindyourlanguage/pull/35) — open, awaiting owner review/merge.
- **Demo:** https://mindyourlanguage-jade-demo.onrender.com (auto-deploys from the feature branch; see `context/render-jade-demo.md`).
- **Final state:** unit 430/430, e2e 35/35, build PASS (16 routes), lint 3 pre-existing errors + 1 warning.
- **Audit trail:** `.superpowers/sdd/` — `progress.md` ledger (per-task minors + decisions), task briefs/reports/reviews, `final-review.md` (opus verdict: SHIP after 13-item fix wave).
- **Plans/spec:** `docs/superpowers/plans/2026-11-27-scholarly-jade-phase-{1..4}-*.md`, `docs/superpowers/specs/2026-11-25-scholarly-jade-redesign-design.md` (deviations section documents what changed vs original spec).

### Locked decisions (don't re-litigate)

- Light mode only (`.dark` removed; `dark:` classes stripped from ui primitives; Toaster pinned light).
- Desktop drawers + mobile full screens with bottom tab bar; mobile header has NO auth controls (mock fidelity; auth flag-gated off).
- Whole-passage pinyin toggle (not per-sentence); 繁 Traditional toggle without classifier data.
- `shadowing-player.tsx` kept (practice drill cards use it); removed from ResultCard.
- Dropped: Try First, ComparisonPanel, NativeAlternativeCard (folded into ResultCard tabs), GroundingPanel (folded into StudyPanel).
- `/api/practice/check` + `lib/practice/check-attempt.ts` UI-orphaned — kept for later cleanup.

### Post-review additions (after the fix wave)

- ResultCard footer: playback-speed dropdown (Radix `components/ui/dropdown-menu.tsx`), speeds 0.25×–1.5×, default 0.75×. Driven by `SPEECH_RATES` const in `result-card.tsx` — widen by editing one line.
- Hydration fix (`1312814`): `use-phrasebook-hydrated` starts `false` + flips in effect; e2e `enter-source-text` retries fill. This killed the e2e flakiness — do not regress to lazy `hasHydrated()` initializers during render.

### If resuming work on this branch

1. Read `.superpowers/sdd/progress.md` (Scholarly Jade section at the bottom).
2. Unmerged: PR #35. Also pending: PR #26 (anonymous Neon persistence) — merge order between them not yet decided; conflicts likely minor (different areas).
3. Demo service cleanup decision pending (suspend/delete when testing done).
