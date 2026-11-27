# Scholarly Jade UI Redesign — Design Spec

**Date:** 2026-11-25
**Status:** Approved (brainstorming complete)
**Source designs:** Google Stitch mockups (`stitch_mandarin_app_ui_redesign_version_1/`): `translate_study_workspace`, `translate_study_mobile`, `practice_speed_drill`, `practice_speed_drill_mobile`, `phrasebook_history_mobile`, `phrase_review_reorganized`, plus `mind_your_language_design_system.md` ("Scholarly Jade").

## Goal

Refactor the entire `apps/web` UI to the Scholarly Jade design system: new token layer, unified app shell, restructured Translate workspace and Practice screens, and native mobile screens — while keeping all existing data flow (zustand stores, SRS logic, Neon persistence) untouched.

## Scope decisions (locked with owner)

- **Full refactor** — tokens AND layout restructure, executed token-first.
- **Carries over:** ZH→EN translation direction (same shell, right-panel tabs that don't apply simply don't render).
- **Dropped:** Try First + ComparisonPanel, shadowing/segment audio player, phrasebook edit flow.
- **`phrase_review_reorganized`** folds into the Translate workspace (interactive reading passage, synced dictionary cards, actionable chunk-failure banner) — it is not a separate route.
- **Desktop Phrasebook/History:** keep existing slide-over drawers (restyled with new tokens). **Mobile:** full screens with bottom tab bar.
- **Light mode only.** The `.dark` token block is removed; dark palette stays documented in the design-system doc for a future pass.
- **Interactive token↔dictionary passage is desktop-only for v1.** Mobile Dictionary tab lists plain cards.

## Execution approach: token-first, then structure

Each phase is independently shippable and testable.

### Phase 1 — Token layer

Remap `apps/web/app/globals.css`:

- Re-point existing shadcn CSS vars to Scholarly Jade values (single source of truth; existing components restyle for free):
  - `--primary` → `#003A30` (light-primary, deep jade)
  - `--background` → `#F9FAF7` (surface), `--card` → `#FFFFFF` (surface-container-lowest)
  - `--muted` → `#EDEEEC` (surface-container), `--secondary` → `#D0E4DD` (secondary-container)
  - `--border` → `#C0C8C4` (outline-variant), `--ring` → `#003A30`, `--destructive` → `#BA1A1A`
- Add new `@theme` tokens shadcn lacks: surface-container ladder (lowest→highest), `warning`/`warning-container`/`success` semantics, gutter spacing scale (`gutter-xs` 4px … `gutter-xl` 32px, `section` 48px, `page-margin` 24px), radius steps (6/8/12/16/24/full), motion utilities (120ms ease-out state-change, 200ms surface-enter).
- Fonts via `next/font/google`: Crimson Pro (display/headline), Commissioner (UI/body/reading), Source Code Pro (pinyin/counts) as `--font-display`, `--font-sans`, `--font-mono`; type scale as utilities (`text-display-lg`, `text-headline-md`, `text-reading-lg`, `text-mono-sm`, …).
- Remove the `.dark` block.
- Do NOT port Stitch's Tailwind-CDN class soup (`bg-light-surface-container-lowest` etc.) — tokens map onto the existing CSS-var layer instead.

### Phase 2 — App shell & routing

New `apps/web/components/app-shell.tsx`, mounted in `app/layout.tsx`:

- **Desktop (≥lg):** unified header (surface-container-lowest, hairline border). Left: Crimson Pro "Mind Your Language" + tagline. Right: chip-nav pills — Translate · Practice (N) · Phrasebook (N) · History. Active chip filled jade; counts `tabular-nums`. Translate/Practice navigate; Phrasebook/History open the existing drawers (chip stays highlighted while its drawer is open).
- **Mobile (<lg):** compact header (title + contextual count pill, e.g. "7 saved" / "6 due") + sticky bottom tab bar: Translate (`translate`), Practice (`bolt`), Saved (`bookmarks`), History (`history`). Active tab gets secondary-container sage pill.
- **Routes:** `/` (Translate), `/practice` (exists), `/phrasebook` (new), `/history` (new). The new routes render full screens on mobile; on desktop they redirect to `/` with the corresponding drawer opened (deep links work, one implementation).
- Counts subscribe to existing zustand stores — no new data flow.

### Phase 3 — Translate workspace (`/`)

Two-column `lg:grid-cols-12` inside `max-w-7xl`. `page.tsx` decomposes into `ComposerCard`, `ResultCard`, `StudyPanel`, `ReadingPassage`; state stays in existing hooks/stores.

**Left column (7/12):**

1. **Composer card:** settings bar with 简体/繁體 + CN/TW segmented pill groups (restyled `Toggles`), EN⇄ZH swap chip, textarea with char counter (`164/1000`), Native alternative checkbox (EN→ZH only), primary Translate + secondary Clear. Try First UI removed.
2. **Result card with register tabs:** "Translation · 中性" / "Native alternative · 口语" (native tab only when a native alternative exists — absorbs `NativeAlternativeCard`). Reading text `reading-lg` (19px/36px), tone-marked pinyin in Source Code Pro. Consolidated footer: Play (jade + icon), 0.75x, Save/Saved toggle, Copy. No Segments button.
3. **Interactive reading passage (EN→ZH, desktop only):** translation rendered as sentence-broken paragraphs; dictionary matches are clickable term tokens. Clicking a token highlights + scrolls to its dictionary card in the right panel and vice versa (bidirectional sync). Pinyin toggle chip reveals per-sentence pinyin lines. Replaces the stacked `GroundingPanel`.

**Right column (5/12, sticky, surface-container-low):**

- **Tabbed study panel — Chunks (N) | New bits (N) | Dictionary (N):**
  - *Chunks:* `PracticeChunksCard` restyled — checkbox rows (zh title, mono pinyin, EN gloss); footer "Save phrase + N chunks" + "Full only".
  - *New bits:* `LearnableSuggestionsCard` restyled — checkbox rows with POS chip + example; "Save selected (N)".
  - *Dictionary:* grounding entries as interactive cards synced with the reading passage; "Trad. & CL" detail toggle.
- Counts from existing `practiceChunks`, `learnables`, `result.dictionaryMatches` — no data-flow changes.

**Chunk failure:** dead-end text replaced by amber `banner-with-action` — "Practice chunks unavailable" + Retry chunks / Save full phrase buttons.

**Mobile (`/`):** single column — composer, tabbed result card, study panel as tabbed card below, bottom tab bar. No token-synced passage.

### Phase 4 — Practice screen (`/practice`)

- **Desktop, left column:** segmented mode tabs Speed (N) | Due today (N) | All saved (N) + tag filter. Panels: restyled `SpeedDrillCard` (amber countdown-timer pill, "Pass 1 of 3" chip), restyled `PracticeDrillCard` recall view, all-saved queue list with status pills ("Speed ready" / "Due today").
- **Desktop, right column (sticky):** reliability panel — `ReliabilityNeedle` data expanded to Stitch layout: "7-day production reliability" headline + 30-day %, 8-week activity strip, three stat tiles (Speed / Due / Saved). No SRS logic changes.
- **Mobile:** compact header with "N due" pill, mode tabs, active drill card, compact reliability card, bottom tab bar.

### Phase 5 — Phrasebook & History mobile screens

- Segmented Phrasebook (N) | History (N) switcher, tag filter, compact phrase cards (zh title + mono pinyin + EN gloss + example sentence).
- No edit flow. The mock's per-card **Edit** button becomes **Remove** (existing phrasebook store remove action + toast). Tapping the card body keeps the current restore-onto-translate behavior.
- Desktop drawers unchanged structurally; restyled by tokens only.

## Error handling & empty states

- Translate errors keep `role="alert"`, styled with the error token pair; 429/502 sonner toasts unchanged (restyled via tokens).
- Chunk failure: amber banner-with-action (Phase 3).
- Empty phrasebook/history: calm empty state ("Nothing saved yet — translate something and save it") instead of a bare list.

## Testing

- Update existing component tests (`grounding-panel`, `native-alternative-card`, `reliability-needle`) for their new homes in study panel / result card.
- New tests: `AppShell` active states (route + drawer), reading-passage token↔card bidirectional sync, result-card register tabs, `/phrasebook` + `/history` route behavior (mobile screen vs desktop redirect-to-drawer).
- Playwright e2e: bottom tab bar on mobile viewport, chip nav + drawers on desktop, new routes.
- Visual fidelity verified by screenshotting implemented screens against the Stitch mocks during each phase.

## Out of scope

- Dark mode (tokens documented, no mocks, future pass).
- Phrasebook edit UI, Try First, shadowing player (dropped).
- Any backend/API, SRS, or persistence changes.

## Implementation notes / deviations

Decisions made during implementation that supersede the text above (each is documented in the phase plans):

- **Shadowing player kept.** `ShadowingPlayer` stays in both drill cards (`PracticeDrillCard`, `SpeedDrillCard`) instead of being dropped; Try First itself is still removed.
- **Whole-passage pinyin toggle.** The reading passage offers a single "Pinyin" chip that reveals the whole passage's pinyin below the text, instead of per-sentence pinyin.
- **繁 Traditional toggle.** The dictionary cards hide traditional forms behind a "繁 Traditional" toggle in the study panel, replacing the "Trad. & CL" treatment.
- **Phases 2 + 5 merged.** The app shell (Phase 2) and the Phrasebook / History mobile screens (Phase 5) shipped together, since the bottom tab bar and the saved-lists screens share the same routes and restore flow.
- **No auth controls in the mobile header.** The mobile header shows only the title and the count pill (e.g. "6 due"); sign-in/out controls stay in the desktop header. This was a human decision.
- **Light mode only is enforced.** `dark:` variants were removed from the shadcn primitives and the Toaster is pinned to the light theme, so the OS dark mode no longer affects any component.
- **Practice count.** The desktop "Practice (N)" chip counts distinct entries that are due or speed-ready (no double counting); the mobile pill shows the due count only.

