# Scholarly Jade — Phase 4: Practice Screen Implementation Plan

**Date:** 2026-11-27
**Spec:** `docs/superpowers/specs/2026-11-25-scholarly-jade-redesign-design.md` (Phase 4)
**Depends on:** Plan 1 (tokens), Plan 2 (app shell — the practice page header is already removed there).
**Goal:** Restructure `/practice` into the Stitch layout: segmented mode tabs (Speed · Due today · All saved), amber timer-pill speed drill, restyled recall card, an all-saved queue list with status pills, and a sticky right-column reliability panel expanded with stat tiles. **No SRS/queue logic changes.**

## Invariants (e2e depends on these — do not break)

- Testids preserved: `mode-due`, `mode-speed`, `mode-all`, `tag-filter`, `speed-drill-card`, `speed-pass` (text `/Pass N of 3/`), `speed-remaining`, `speed-attempt`, `speed-check`, `speed-miss`, `speed-done`, `speed-status`, `speed-next`, `speed-try-again`, `practice-drill-card`, `drill-prompt`, `drill-answer`, `drill-reveal`, `grade-*`, `practice-empty`, `parent-chunk-status`, `reliability-needle`, `reliability-hero`.
- The non-empty reliability needle keeps exactly **one** `p.text-sm.text-muted-foreground` (the subline) — `practice.spec.ts` locates it by those classes.
- Default mode stays `"due"` (e2e drills a freshly saved phrase without switching modes).
- `ShadowingPlayer` stays inside both drill cards.

All commands run from `apps/web`.

---

## Task 1: `PracticeQueueList` — all-saved queue with status pills

Presentational component; the page computes the id sets with existing selectors (`getSpeedEntries`, `getDueEntries`).

**Files:**
- Create: `apps/web/components/practice-queue-list.tsx`
- Test: `apps/web/components/practice-queue-list.test.ts`

### Step 1: RED — failing test

```ts
// apps/web/components/practice-queue-list.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PracticeQueueList } from "./practice-queue-list";
import type { PhrasebookEntry } from "@mindyourlanguage/shared";

function entry(id: string, translation: string): PhrasebookEntry {
  return {
    id,
    translationId: `t-${id}`,
    sourceText: `source ${id}`,
    sourceLang: "en",
    targetLang: "zh",
    translation,
    characterSet: "simplified",
    dictionaryMatches: [],
    segments: [],
    tags: [],
    notes: "",
    createdAt: "2026-11-01T00:00:00.000Z",
  };
}

const entries = [entry("a", "你好"), entry("b", "谢谢"), entry("c", "再见")];

function renderList(overrides: Partial<Parameters<typeof PracticeQueueList>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(PracticeQueueList, {
      entries,
      currentId: "b",
      speedReadyIds: new Set(["a", "b"]),
      dueIds: new Set(["b"]),
      onSelect: () => {},
      ...overrides,
    }),
  );
}

describe("PracticeQueueList", () => {
  it("lists every queue entry with zh title and source gloss", () => {
    const html = renderList();
    expect(html).toContain('data-testid="practice-queue-list"');
    expect(html).toContain("你好");
    expect(html).toContain("source c");
  });

  it("marks the current entry", () => {
    const html = renderList();
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('data-entry-id="b"');
  });

  it("renders status pills from the id sets", () => {
    const html = renderList();
    expect(html).toContain("Speed ready");
    expect(html).toContain("Due today");
    // entry c has neither status
    const rowC = html.slice(html.indexOf('data-entry-id="c"'));
    expect(rowC).not.toContain("Speed ready");
    expect(rowC).not.toContain("Due today");
  });

  it("uses sage for speed and amber for due", () => {
    const source = renderList();
    expect(source).toContain("bg-secondary");
    expect(source).toContain("bg-warning-container");
  });
});
```

### Step 2: run to confirm failure

```bash
cd apps/web && npm test -- practice-queue-list
```

### Step 3: GREEN — implement

```tsx
// apps/web/components/practice-queue-list.tsx
"use client";

import type { PhrasebookEntry } from "@mindyourlanguage/shared";

interface PracticeQueueListProps {
  entries: PhrasebookEntry[];
  currentId: string | null;
  speedReadyIds: ReadonlySet<string>;
  dueIds: ReadonlySet<string>;
  onSelect: (index: number) => void;
}

export function PracticeQueueList({
  entries,
  currentId,
  speedReadyIds,
  dueIds,
  onSelect,
}: PracticeQueueListProps) {
  if (entries.length === 0) return null;

  return (
    <section
      aria-label="All saved queue"
      data-testid="practice-queue-list"
      className="flex flex-col gap-2"
    >
      <h2 className="text-title-md text-foreground">Up next</h2>
      <ul className="flex flex-col gap-2">
        {entries.map((item, index) => {
          const isCurrent = item.id === currentId;
          return (
            <li key={item.id}>
              <button
                type="button"
                data-testid="queue-row"
                data-entry-id={item.id}
                aria-current={isCurrent || undefined}
                onClick={() => onSelect(index)}
                className={`flex w-full flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left transition-colors duration-state-change ease-state-change hover:border-primary/50 ${
                  isCurrent
                    ? "border-primary ring-1 ring-primary"
                    : "border-border"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">
                    {item.translation}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {item.sourceText}
                  </span>
                </span>
                {speedReadyIds.has(item.id) ? (
                  <span
                    data-testid="queue-pill-speed"
                    className="rounded-full bg-secondary px-2 py-0.5 text-label-sm text-secondary-foreground"
                  >
                    Speed ready
                  </span>
                ) : null}
                {dueIds.has(item.id) ? (
                  <span
                    data-testid="queue-pill-due"
                    className="rounded-full bg-warning-container px-2 py-0.5 text-label-sm text-on-warning-container"
                  >
                    Due today
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

### Step 4: verify

```bash
cd apps/web && npm test -- practice-queue-list
```

Expected: 4 tests pass.

---

## Task 2: `ReliabilityNeedle` — add Speed / Due today / Saved stat tiles

Expands the needle into the Stitch right-column panel. Helpers, sparkline, hero, subline, and the empty/loading markup are untouched; a hydration-gated tile row is appended.

**Files:**
- Modify: `apps/web/components/reliability-needle.tsx`
- Test: `apps/web/components/reliability-needle.structure.test.ts` (new, fs source-assertions — avoids store mocking)

### Step 1: RED — failing structure test

```ts
// apps/web/components/reliability-needle.structure.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./reliability-needle.tsx", import.meta.url),
  "utf8",
);

describe("ReliabilityNeedle stat tiles", () => {
  it("renders Speed, Due today and Saved tiles", () => {
    expect(source).toContain('data-testid="stat-speed"');
    expect(source).toContain('data-testid="stat-due"');
    expect(source).toContain('data-testid="stat-saved"');
    expect(source).toContain("Speed");
    expect(source).toContain("Due today");
    expect(source).toContain("Saved");
  });

  it("pulls counts from the phrasebook store with a hydration guard", () => {
    expect(source).toContain("usePhrasebookStore");
    expect(source).toContain("getDueCount");
    expect(source).toContain("getSpeedCount");
    expect(source).toContain("onFinishHydration");
  });

  it("keeps the existing e2e contract", () => {
    expect(source).toContain('data-testid="reliability-needle"');
    expect(source).toContain('data-testid="reliability-hero"');
    expect(source).toContain("7-day production reliability");
    expect(source).toContain("Last 8 weeks");
    expect(source).toContain(
      "Practice a few due phrases to unlock your needle.",
    );
  });

  it("keeps a single text-sm subline in the non-empty state", () => {
    // practice.spec.ts locates the subline via 'p.text-sm.text-muted-foreground'
    // inside the non-empty needle. Exactly three usages may exist in the file:
    // loading state, empty state, and the main-state subline — no fourth.
    const matches = source.match(/text-sm text-muted-foreground/g) ?? [];
    expect(matches.length).toBeLessThanOrEqual(3);
  });
});
```

### Step 2: run to confirm failure

```bash
cd apps/web && npm test -- reliability-needle.structure
```

### Step 3: GREEN — modify `apps/web/components/reliability-needle.tsx`

**a) Imports — merge `useState` into the existing react import and add the store:**

```ts
import { useEffect, useMemo, useState } from "react";
import { usePhrasebookStore } from "@/lib/stores/phrasebook";
```

**b) Inside `ReliabilityNeedle`, below the existing store hooks — add:**

```ts
  const phrasebookItems = usePhrasebookStore((state) => state.items);
  const getDueCount = usePhrasebookStore((state) => state.getDueCount);
  const getSpeedCount = usePhrasebookStore((state) => state.getSpeedCount);
  const [phrasebookHydrated, setPhrasebookHydrated] = useState(() =>
    typeof window !== "undefined"
      ? usePhrasebookStore.persist.hasHydrated()
      : false,
  );

  useEffect(() => {
    if (usePhrasebookStore.persist.hasHydrated()) {
      setPhrasebookHydrated(true);
      return;
    }
    return usePhrasebookStore.persist.onFinishHydration(() => {
      setPhrasebookHydrated(true);
    });
  }, []);
```

**c) Add a tiles renderer above the component (module scope):**

```tsx
function StatTiles({
  speedCount,
  dueCount,
  savedCount,
}: {
  speedCount: number;
  dueCount: number;
  savedCount: number;
}) {
  const tiles = [
    { label: "Speed", value: speedCount, testid: "stat-speed" },
    { label: "Due today", value: dueCount, testid: "stat-due" },
    { label: "Saved", value: savedCount, testid: "stat-saved" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2" aria-label="Practice counts">
      {tiles.map((tile) => (
        <div
          key={tile.testid}
          data-testid={tile.testid}
          className="rounded-lg bg-card px-3 py-2"
        >
          <p className="text-label-sm text-muted-foreground">{tile.label}</p>
          <p className="text-title-md tabular-nums text-foreground">
            {tile.value}
          </p>
        </div>
      ))}
    </div>
  );
}
```

**d) Restructure the returns.** Replace the `if (shouldShowEmptyNeedle(events)) { … }` early return and the final `return (…)` with:

```tsx
  const tiles = phrasebookHydrated ? (
    <StatTiles
      speedCount={getSpeedCount()}
      dueCount={getDueCount()}
      savedCount={phrasebookItems.length}
    />
  ) : null;

  if (shouldShowEmptyNeedle(events)) {
    return (
      <section
        data-testid="reliability-needle"
        className="flex flex-col gap-3 rounded-lg border border-border/60 px-4 py-3"
      >
        <div>
          <p className="text-sm text-muted-foreground">
            Practice a few due phrases to unlock your needle.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Based on self-grades
          </p>
        </div>
        {tiles}
      </section>
    );
  }

  const hero = getSevenDayHero(sevenDay);
  const subline = getSevenDaySubline(sevenDay);

  return (
    <section
      data-testid="reliability-needle"
      className="flex flex-col gap-3 rounded-lg border border-border/60 px-4 py-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex flex-col gap-1"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="sr-only">{liveSummary}</p>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            7-day production reliability
          </p>
          <p
            data-testid="reliability-hero"
            className="text-2xl font-semibold tracking-tight text-foreground"
          >
            {hero}
          </p>
          <p className="text-sm text-muted-foreground">{subline}</p>
          <p className="text-xs text-muted-foreground">
            30-day:{" "}
            {thirtyDay.percent == null ? "—" : `${thirtyDay.percent}%`} · Based
            on self-grades
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <p className="text-xs text-muted-foreground">Last 8 weeks</p>
          <Sparkline weeks={weekly} />
        </div>
      </div>
      {tiles}
    </section>
  );
```

The loading branch (`!hasHydrated`) stays exactly as it is today (no tiles — counts unknown).

### Step 4: verify

```bash
cd apps/web && npm test -- reliability-needle
```

Expected: existing helper tests + 4 structure tests pass.

---

## Task 3: `SpeedDrillCard` — amber timer pill + pass chip

**Files:**
- Modify: `apps/web/components/speed-drill-card.tsx`
- Test: `apps/web/components/speed-drill-card.structure.test.ts` (new, fs source-assertions)

### Step 1: RED — failing test

```ts
// apps/web/components/speed-drill-card.structure.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./speed-drill-card.tsx", import.meta.url),
  "utf8",
);

describe("SpeedDrillCard Stitch restyle", () => {
  it("renders the countdown as an amber pill", () => {
    expect(source).toContain("bg-warning-container");
    expect(source).toContain("text-on-warning-container");
    expect(source).toContain('data-testid="speed-remaining"');
  });

  it("renders the pass counter as a chip", () => {
    expect(source).toContain('data-testid="speed-pass"');
    expect(source).toContain("rounded-full bg-muted");
    expect(source).toContain("Pass {session.passIndex + 1} of {session.passCount}");
  });

  it("keeps the e2e contract", () => {
    for (const testid of [
      "speed-drill-card",
      "drill-prompt",
      "speed-status",
      "speed-attempt",
      "speed-check",
      "speed-miss",
      "speed-done",
      "speed-next",
      "speed-try-again",
    ]) {
      expect(source).toContain(`data-testid="${testid}"`);
    }
    expect(source).toContain("ShadowingPlayer");
  });
});
```

### Step 2: run to confirm failure

```bash
cd apps/web && npm test -- speed-drill-card.structure
```

### Step 3: GREEN — edit `apps/web/components/speed-drill-card.tsx`

Replace the running-phase header block:

```tsx
            <p className="text-sm text-muted-foreground" data-testid="speed-pass">
              Pass {session.passIndex + 1} of {session.passCount} ·{" "}
              {session.passLimitSeconds} seconds
            </p>
            <p
              className="text-3xl font-semibold tabular-nums text-foreground"
              data-testid="speed-remaining"
            >
              {session.secondsLeft}
            </p>
```

with:

```tsx
            <div className="flex flex-wrap items-center gap-2">
              <p
                className="rounded-full bg-muted px-3 py-1 text-label-sm text-muted-foreground"
                data-testid="speed-pass"
              >
                Pass {session.passIndex + 1} of {session.passCount} ·{" "}
                {session.passLimitSeconds} seconds
              </p>
              <p
                className="rounded-full bg-warning-container px-3 py-1 font-mono text-title-md tabular-nums text-on-warning-container"
                data-testid="speed-remaining"
                aria-label="Seconds remaining"
              >
                {session.secondsLeft}
              </p>
            </div>
```

Also restyle the card header to include the mode label per mock — change `<CardTitle>Speed</CardTitle>` to:

```tsx
        <CardTitle className="flex items-center gap-2">
          Speed drill
          <span className="rounded-full bg-secondary px-2 py-0.5 text-label-sm font-normal text-secondary-foreground">
            Beat the clock
          </span>
        </CardTitle>
```

Everything else (form, miss block, done block, footer) is unchanged.

### Step 4: verify

```bash
cd apps/web && npm test -- speed-drill-card.structure
```

Expected: 3 tests pass.

---

## Task 4: `PracticeDrillCard` — recall view restyle

Light restyle only; every testid and button stays.

**Files:**
- Modify: `apps/web/components/practice-drill-card.tsx`
- Test: `apps/web/components/practice-drill-card.structure.test.ts` (new, fs source-assertions)

### Step 1: RED — failing test

```ts
// apps/web/components/practice-drill-card.structure.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./practice-drill-card.tsx", import.meta.url),
  "utf8",
);

describe("PracticeDrillCard Stitch restyle", () => {
  it("presents the prompt at reading size and the answer on a muted well", () => {
    expect(source).toContain("text-reading-lg");
    expect(source).toContain("rounded-lg bg-muted");
  });

  it("keeps the e2e contract", () => {
    for (const testid of [
      "practice-drill-card",
      "drill-prompt",
      "drill-answer",
      "drill-reveal",
      "grade-again",
      "grade-hard",
      "grade-good",
      "grade-easy",
    ]) {
      expect(source).toContain(`data-testid="${testid}"`);
    }
    expect(source).toContain("ShadowingPlayer");
  });
});
```

### Step 2: run to confirm failure

```bash
cd apps/web && npm test -- practice-drill-card.structure
```

### Step 3: GREEN — edit `apps/web/components/practice-drill-card.tsx`

- Prompt paragraph: change `className="break-anywhere text-lg leading-relaxed text-foreground"` → `className="break-anywhere text-reading-lg text-foreground"`.
- Answer container: change `<div className="flex flex-col gap-3" data-testid="drill-answer">` → `<div className="flex flex-col gap-3 rounded-lg bg-muted p-4" data-testid="drill-answer">`.
- Answer zh text: `text-xl font-medium` → `text-reading-lg font-medium`.
- Pinyin line: add `font-mono text-mono-sm` (replace `text-sm`) for the Scholarly Jade pinyin treatment.

### Step 4: verify

```bash
cd apps/web && npm test -- practice-drill-card.structure
```

Expected: 2 tests pass.

---

## Task 5: `practice/page.tsx` — segmented mode tabs + two-column layout

Starts from the post-Plan-2 file (page header and `Link` import already removed).

**Files:**
- Modify: `apps/web/app/practice/page.tsx`
- Test: `apps/web/app/practice/page.layout.test.ts` (new, fs source-assertions)

### Step 1: RED — failing test

```ts
// apps/web/app/practice/page.layout.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("practice workspace layout", () => {
  it("uses a 12-column grid inside max-w-7xl with a sticky right column", () => {
    expect(source).toContain("max-w-7xl");
    expect(source).toContain("lg:grid-cols-12");
    expect(source).toContain("lg:col-span-7");
    expect(source).toContain("lg:col-span-5");
    expect(source).toContain("lg:sticky");
  });

  it("renders mode selection as segmented tabs in spec order", () => {
    expect(source).toContain('role="tablist"');
    const speed = source.indexOf('data-testid="mode-speed"');
    const due = source.indexOf('data-testid="mode-due"');
    const all = source.indexOf('data-testid="mode-all"');
    expect(speed).toBeGreaterThan(-1);
    expect(due).toBeGreaterThan(speed);
    expect(all).toBeGreaterThan(due);
  });

  it("keeps aria-selected tab semantics", () => {
    expect(source).toContain('role="tab"');
    expect(source).toContain("aria-selected={mode ===");
  });

  it("renders the queue list in all mode", () => {
    expect(source).toContain("<PracticeQueueList");
    expect(source).toContain('mode === "all"');
  });

  it("no longer uses the old button trio for modes", () => {
    expect(source).not.toContain("variant={mode ===");
  });
});
```

### Step 2: run to confirm failure

```bash
cd apps/web && npm test -- page.layout
```

### Step 3: GREEN — rewire `apps/web/app/practice/page.tsx`

**a) Imports — remove `Button`; add:**

```ts
import { PracticeQueueList } from "@/components/practice-queue-list";
import { getDueEntries } from "@/lib/practice/srs";
import { getSpeedEntries } from "@/lib/practice/fluency";
```

**b) Derived state — add below the existing `chunkStatus` computation:**

```ts
  const speedReadyIds = useMemo(
    () => new Set(getSpeedEntries(items).map((entry) => entry.id)),
    [items],
  );
  const dueIds = useMemo(
    () => new Set(getDueEntries(items).map((entry) => entry.id)),
    [items],
  );
```

**c) Handler — add:**

```ts
  function handleQueueSelect(index: number) {
    setQueueIndex(index);
    setPinnedEntryId(null);
    resetRecallCard();
  }
```

**d) Replace the mode-button row + tag filter block** (the three `<Button>`s and the `<input>`) with:

```tsx
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="Practice mode"
          className="flex flex-wrap gap-1 rounded-full bg-muted p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "speed"}
            data-testid="mode-speed"
            onClick={() => handleModeChange("speed")}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors duration-state-change ease-state-change ${
              mode === "speed"
                ? "bg-card font-medium text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Speed ({phrasebookHydrated ? speedCount : "…"})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "due"}
            data-testid="mode-due"
            onClick={() => handleModeChange("due")}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors duration-state-change ease-state-change ${
              mode === "due"
                ? "bg-card font-medium text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Due today ({phrasebookHydrated ? dueCount : "…"})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "all"}
            data-testid="mode-all"
            onClick={() => handleModeChange("all")}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors duration-state-change ease-state-change ${
              mode === "all"
                ? "bg-card font-medium text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            All saved ({phrasebookHydrated ? savedCount : "…"})
          </button>
        </div>
        <input
          value={tagFilter}
          onChange={(event) => handleTagFilterChange(event.target.value)}
          placeholder="Filter by tag"
          className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8 sm:max-w-xs sm:flex-none sm:text-sm"
          data-testid="tag-filter"
        />
      </div>
```

**e) Replace the `<main …>` wrapper and overall structure** so the drills live in the left column and the needle in a sticky right column. The full return becomes:

```tsx
  return (
    <main className="mx-auto grid w-full min-w-0 max-w-7xl flex-1 gap-6 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
        {/* mode tablist + tag filter block from step (d) */}

        {current && mode === "speed" ? (
          <SpeedDrillCard
            key={`${current.id}-${speedRound}`}
            entry={current}
            onSessionComplete={handleSpeedComplete}
            onNext={handleSpeedNext}
            voiceRegion={voiceRegion}
          />
        ) : null}
        {chunkStatus ? (
          <p className="text-sm text-muted-foreground" data-testid="parent-chunk-status">
            {chunkStatus}
          </p>
        ) : null}
        {current && mode !== "speed" ? (
          <PracticeDrillCard
            entry={current}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            onGrade={handleGrade}
            voiceRegion={voiceRegion}
          />
        ) : null}
        {!current ? (
          <p className="text-sm text-muted-foreground" data-testid="practice-empty">
            {practiceEmptyMessage(mode, items, tagFilter)}
          </p>
        ) : null}
        {mode === "all" && queue.length > 0 ? (
          <PracticeQueueList
            entries={queue}
            currentId={current?.id ?? null}
            speedReadyIds={speedReadyIds}
            dueIds={dueIds}
            onSelect={handleQueueSelect}
          />
        ) : null}
      </div>

      <div className="min-w-0 lg:col-span-5">
        <div className="lg:sticky lg:top-20">
          <ReliabilityNeedle />
        </div>
      </div>
    </main>
  );
```

(The mode tablist JSX from step d goes where the comment is; the old top-level `<ReliabilityNeedle />` line is removed from the left flow.)

**f) Cleanup:** confirm `Button` is no longer referenced and its import is gone; `DrillMode`, `resolvePracticeEntry`, `buildPracticeQueue`, `practiceEmptyMessage`, `parentChunkStatus` imports all stay.

### Step 4: verify

```bash
cd apps/web && npm test -- page.layout && npm run lint
```

Expected: 5 layout tests pass, lint clean.

---

## Task 6: e2e — queue list + stat tiles

**Files:**
- Create: `apps/web/e2e/practice-layout.spec.ts`

Existing `practice.spec.ts` needs **no changes** (all testids and the subline locator are preserved).

### Step 1: write the spec

```ts
import { expect, test } from '@playwright/test'
import { enterSourceText } from './helpers/enter-source-text'
import { mockTranslateApi } from './helpers/mock-translate'

test.describe('practice layout (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await mockTranslateApi(page)
    await page.goto('/')
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()
    await page.getByRole('button', { name: 'Save to phrasebook' }).click()
    await page.getByRole('link', { name: 'Practice' }).click()
    await expect(page).toHaveURL(/\/practice/)
  })

  test('mode tabs render in spec order with counts', async ({ page }) => {
    await expect(page.getByTestId('mode-speed')).toContainText('Speed (1)')
    await expect(page.getByTestId('mode-due')).toContainText('Due today (1)')
    await expect(page.getByTestId('mode-all')).toContainText('All saved (1)')
  })

  test('all mode lists the queue with status pills and jumps on click', async ({
    page,
  }) => {
    await page.getByTestId('mode-all').click()
    await expect(page.getByTestId('practice-queue-list')).toBeVisible()
    await expect(page.getByTestId('queue-pill-speed').first()).toHaveText(
      'Speed ready',
    )
    await expect(page.getByTestId('queue-pill-due').first()).toHaveText(
      'Due today',
    )
    await page.getByTestId('queue-row').first().click()
    await expect(page.getByTestId('practice-drill-card')).toBeVisible()
  })

  test('reliability panel shows stat tiles after a review', async ({ page }) => {
    await page.getByTestId('drill-reveal').click()
    await page.getByTestId('grade-good').click()
    await expect(page.getByTestId('stat-saved')).toContainText('1')
    await expect(page.getByTestId('stat-speed')).toBeVisible()
    await expect(page.getByTestId('stat-due')).toBeVisible()
    await expect(page.getByTestId('reliability-hero')).toBeVisible()
  })
})
```

A freshly saved entry is both speed-eligible and due (existing `practice.spec.ts` speed tests prove speed eligibility; `isDue` is true for new stats), so both pills render.

### Step 2: full verification

```bash
cd apps/web && npm test && npm run lint && npm run build && npm run test:e2e
```

Expected: unit suite green (including `practice-queue-list` 4, `reliability-needle.structure` 4, `speed-drill-card.structure` 3, `practice-drill-card.structure` 2, `page.layout` 5), lint clean, build compiles, full e2e green.

---

## Done-when checklist

- [ ] `/practice` renders mode tabs (Speed · Due today · All saved) with live counts, tag filter beside them
- [ ] Desktop: drills left (7/12), sticky reliability panel right (5/12) with hero, 30-day, 8-week strip and Speed/Due/Saved tiles
- [ ] Speed drill shows the amber countdown pill and pass chip
- [ ] All mode shows the queue list with "Speed ready" / "Due today" pills; clicking a row loads that entry
- [ ] Mobile stacks: tabs → drill → reliability card; bottom tab bar unchanged
- [ ] No changes to SRS, queue, fluency, or persistence logic
- [ ] e2e suite green (old + new specs)
- [ ] Screenshot review against `practice_speed_drill` and `practice_speed_drill_mobile` mocks
