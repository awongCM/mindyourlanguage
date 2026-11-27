# Scholarly Jade Phase 2 — App Shell & Saved/History Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app its unified shell — desktop chip-nav header, mobile compact header + sticky bottom tab bar — plus `/phrasebook` and `/history` routes that render full screens on mobile and open the existing drawers on desktop.

**Architecture:** A client `AppShell` mounted in `app/layout.tsx` owns navigation and hosts the existing drawers. Cross-page restore (drawer or list card → populate the Translate form) works via a `/?restore=<id>` search param consumed by the home page; desktop deep-links to `/phrasebook`/`/history` redirect to `/?drawer=<name>`, which the shell converts into an opened drawer. This plan merges spec Phases 2 and 5 because the new routes need the mobile screens to render anything.

**Tech Stack:** Next.js 16 App Router, Tailwind v4 Scholarly Jade tokens (Phase 1), zustand stores, lucide-react icons, Vitest (renderToStaticMarkup + fs source-assertion house style), Playwright.

**Design spec:** `docs/superpowers/specs/2026-11-25-scholarly-jade-redesign-design.md` (Phases 2 + 5)

## Global Constraints

- **Requires Phase 1 landed** (`*-gutter-*` spacing, `text-label-sm`/`text-body-md`/`text-mono-sm` type utilities, `text-pinyin`, `.duration-state-change`/`.ease-state-change`, jade palette).
- Accessible names must stay count-free: counts render in `<span aria-hidden="true">` so existing e2e (`name: 'Phrasebook'`, `name: 'Practice'`, `exact: true`) keeps passing.
- Light mode only. No bare `rounded` — always a sized radius. Bottom tab bar and mobile header are `lg:hidden`; desktop header is `hidden lg:block`.
- `useSearchParams` must always sit inside a `<Suspense>` boundary (Next.js build requirement).
- Drawer content is NOT restructured in this phase — the existing `PhrasebookDrawer`/`HistoryDrawer` are reused as-is (tokens already restyled them).
- No edit UI anywhere; list cards expose **Remove** only. Tag editing/notes stay inside the desktop Phrasebook drawer (unchanged).
- House test style: `renderToStaticMarkup` + `createElement` for components; fs source-assertions for routing/config glue; Playwright for integration.
- **Read `apps/web/AGENTS.md` before touching `app/` files** (Next.js 16 breaking changes).
- Run all commands from `apps/web` unless stated otherwise.

## File map

| File | Responsibility |
|---|---|
| `apps/web/lib/restore-target.ts` | Pure lookup: restore id → phrasebook entry or history record |
| `apps/web/lib/restore-target.test.ts` | Lookup tests |
| `apps/web/components/app-shell/use-is-desktop.ts` | `matchMedia("(min-width: 1024px)")` hook (SSR-safe, tri-state) |
| `apps/web/lib/stores/use-phrasebook-hydrated.ts` | Phrasebook persist-hydration hook |
| `apps/web/components/app-shell/restore-param-sync.tsx` | `?restore=` param → callback, strips param when done |
| `apps/web/components/app-shell/drawer-param-sync.tsx` | `?drawer=` param → open drawer, strips param |
| `apps/web/components/app-shell/app-shell.tsx` | Desktop header, mobile header, bottom tab bar, drawer hosting |
| `apps/web/components/app-shell/app-shell.structure.test.ts` | fs source-assertions for shell contract |
| `apps/web/components/lists/phrase-list-card.tsx` | Presentational saved/history card |
| `apps/web/components/lists/phrase-list-card.test.ts` | Static-markup card tests |
| `apps/web/components/lists/saved-lists-screen.tsx` | Phrasebook/History mobile screens + segmented switcher |
| `apps/web/app/phrasebook/page.tsx` | Route: mobile screen; desktop → `/?drawer=phrasebook` |
| `apps/web/app/history/page.tsx` | Route: mobile screen; desktop → `/?drawer=history` |
| `apps/web/app/layout.tsx` | Mount `AppShell`; delete old header |
| `apps/web/app/page.tsx` | Delete page header + drawers; add `RestoreParamSync` |
| `apps/web/app/practice/page.tsx` | Delete redundant page header |
| `apps/web/e2e/app-shell.spec.ts` | Shell navigation e2e |

---

### Task 1: Restore-target lookup helper

**Files:**
- Create: `apps/web/lib/restore-target.ts`
- Test: `apps/web/lib/restore-target.test.ts`

**Interfaces:**
- Consumes: `PhrasebookEntry`, `TranslationRecord` from `@mindyourlanguage/shared`.
- Produces: `findRestoreTarget(phrasebookItems: PhrasebookEntry[], historyItems: TranslationRecord[], id: string): RestoreTarget | null` where `RestoreTarget = { kind: "phrasebook"; entry: PhrasebookEntry } | { kind: "history"; record: TranslationRecord }`. Phrasebook wins on id collision. Used by `app/page.tsx` (Task 3).

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/restore-target.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PhrasebookEntry, TranslationRecord } from "@mindyourlanguage/shared";
import { findRestoreTarget } from "./restore-target";

const phrase = { id: "p1" } as PhrasebookEntry;
const record = { id: "h1" } as TranslationRecord;

describe("findRestoreTarget", () => {
  it("finds a phrasebook entry by id", () => {
    expect(findRestoreTarget([phrase], [record], "p1")).toEqual({
      kind: "phrasebook",
      entry: phrase,
    });
  });

  it("finds a history record by id", () => {
    expect(findRestoreTarget([phrase], [record], "h1")).toEqual({
      kind: "history",
      record,
    });
  });

  it("prefers the phrasebook when both stores contain the id", () => {
    const shared = { id: "same" } as PhrasebookEntry;
    const sharedRecord = { id: "same" } as TranslationRecord;
    expect(findRestoreTarget([shared], [sharedRecord], "same")?.kind).toBe(
      "phrasebook",
    );
  });

  it("returns null when the id is unknown", () => {
    expect(findRestoreTarget([phrase], [record], "nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- restore-target`
Expected: FAIL — module `./restore-target` does not exist.

- [ ] **Step 3: Implement the helper**

Create `apps/web/lib/restore-target.ts`:

```ts
import type {
  PhrasebookEntry,
  TranslationRecord,
} from "@mindyourlanguage/shared";

export type RestoreTarget =
  | { kind: "phrasebook"; entry: PhrasebookEntry }
  | { kind: "history"; record: TranslationRecord };

export function findRestoreTarget(
  phrasebookItems: PhrasebookEntry[],
  historyItems: TranslationRecord[],
  id: string,
): RestoreTarget | null {
  const entry = phrasebookItems.find((item) => item.id === id);
  if (entry) return { kind: "phrasebook", entry };
  const record = historyItems.find((item) => item.id === id);
  if (record) return { kind: "history", record };
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- restore-target`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/restore-target.ts apps/web/lib/restore-target.test.ts
git commit -m "feat(shell): restore-target lookup for cross-page restore"
```

---

### Task 2: Shell hooks + search-param sync components

**Files:**
- Create: `apps/web/components/app-shell/use-is-desktop.ts`
- Create: `apps/web/lib/stores/use-phrasebook-hydrated.ts`
- Create: `apps/web/components/app-shell/restore-param-sync.tsx`
- Create: `apps/web/components/app-shell/drawer-param-sync.tsx`
- Test: `apps/web/components/app-shell/sync.structure.test.ts`

**Interfaces:**
- Consumes: `usePhrasebookStore` (existing).
- Produces:
  - `useIsDesktop(): boolean | null` — `null` pre-hydration.
  - `usePhrasebookHydrated(): boolean` — same pattern as `app/practice/page.tsx`'s inline logic.
  - `RestoreParamSync({ onRestore }: { onRestore: (id: string) => "restored" | "pending" | "missing" })` — strips `?restore=` unless result is `"pending"` (stores not hydrated yet; retries on re-render).
  - `DrawerParamSync({ onOpenDrawer }: { onOpenDrawer: (drawer: string) => void })` — opens drawer for `?drawer=phrasebook|history` and strips the param.
  - Both sync components render `null` and MUST be wrapped in `<Suspense fallback={null}>` by the consumer.

- [ ] **Step 1: Write the failing test**

Create `apps/web/components/app-shell/sync.structure.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const restoreSync = readFileSync(
  new URL("./restore-param-sync.tsx", import.meta.url),
  "utf8",
);
const drawerSync = readFileSync(
  new URL("./drawer-param-sync.tsx", import.meta.url),
  "utf8",
);
const isDesktop = readFileSync(
  new URL("./use-is-desktop.ts", import.meta.url),
  "utf8",
);
const hydrated = readFileSync(
  new URL("../../lib/stores/use-phrasebook-hydrated.ts", import.meta.url),
  "utf8",
);

describe("shell sync components", () => {
  it("RestoreParamSync keeps the param while stores are pending", () => {
    expect(restoreSync).toContain("useSearchParams");
    expect(restoreSync).toContain('"restore"');
    expect(restoreSync).toContain('"pending"');
    expect(restoreSync).toContain('result === "restored" || result === "missing"');
    expect(restoreSync).toContain("router.replace");
  });

  it("DrawerParamSync opens only known drawers and strips the param", () => {
    expect(drawerSync).toContain('"drawer"');
    expect(drawerSync).toContain('"phrasebook"');
    expect(drawerSync).toContain('"history"');
    expect(drawerSync).toContain("router.replace");
  });

  it("useIsDesktop tracks the lg breakpoint", () => {
    expect(isDesktop).toContain('"(min-width: 1024px)"');
    expect(isDesktop).toContain("matchMedia");
    expect(isDesktop).toContain("boolean | null");
  });

  it("usePhrasebookHydrated follows the persist hydration pattern", () => {
    expect(hydrated).toContain("usePhrasebookStore.persist.hasHydrated()");
    expect(hydrated).toContain("onFinishHydration");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- sync.structure`
Expected: FAIL — files do not exist.

- [ ] **Step 3: Implement the four files**

Create `apps/web/components/app-shell/use-is-desktop.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";

/** `null` until the client has measured — render nothing that depends on it. */
export function useIsDesktop(): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop;
}
```

Create `apps/web/lib/stores/use-phrasebook-hydrated.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { usePhrasebookStore } from "@/lib/stores/phrasebook";

export function usePhrasebookHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() =>
    typeof window !== "undefined"
      ? usePhrasebookStore.persist.hasHydrated()
      : false,
  );

  useEffect(() => {
    if (usePhrasebookStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return usePhrasebookStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
  }, []);

  return hydrated;
}
```

Create `apps/web/components/app-shell/restore-param-sync.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export type RestoreResult = "restored" | "pending" | "missing";

interface RestoreParamSyncProps {
  onRestore: (id: string) => RestoreResult;
}

/** Consumes `?restore=<id>`; keeps the param while stores report "pending". */
export function RestoreParamSync({ onRestore }: RestoreParamSyncProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const param = searchParams.get("restore");

  useEffect(() => {
    if (!param) return;
    const result = onRestore(param);
    if (result === "restored" || result === "missing") {
      router.replace("/", { scroll: false });
    }
  }, [param, onRestore, router]);

  return null;
}
```

Create `apps/web/components/app-shell/drawer-param-sync.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

interface DrawerParamSyncProps {
  onOpenDrawer: (drawer: string) => void;
}

/** Turns `/?drawer=phrasebook|history` into an opened drawer, then strips the param. */
export function DrawerParamSync({ onOpenDrawer }: DrawerParamSyncProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const param = searchParams.get("drawer");

  useEffect(() => {
    if (param === "phrasebook" || param === "history") {
      onOpenDrawer(param);
      router.replace("/", { scroll: false });
    }
  }, [param, onOpenDrawer, router]);

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- sync.structure`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/app-shell/use-is-desktop.ts apps/web/components/app-shell/restore-param-sync.tsx apps/web/components/app-shell/drawer-param-sync.tsx apps/web/components/app-shell/sync.structure.test.ts apps/web/lib/stores/use-phrasebook-hydrated.ts
git commit -m "feat(shell): hooks and search-param sync components"
```

---

### Task 3: AppShell + layout/page rewiring

**Files:**
- Create: `apps/web/components/app-shell/app-shell.tsx`
- Test: `apps/web/components/app-shell/app-shell.structure.test.ts`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/practice/page.tsx`

**Interfaces:**
- Consumes: `DrawerParamSync` + `RestoreParamSync` + `RestoreResult` (Task 2), `usePhrasebookHydrated` (Task 2), `findRestoreTarget` (Task 1), existing `PhrasebookDrawer`/`HistoryDrawer` (props: `open`, `onOpenChange`, `onSelect`), `AuthHeaderActions`, `OnboardingSyncHint`.
- Produces: `<AppShell>{children}</AppShell>` for `layout.tsx`. Nav contract consumed by e2e: desktop links named `Translate`/`Practice`, buttons named `Phrasebook`/`History`; mobile tab links named `Translate`/`Practice`/`Saved`/`History` (counts aria-hidden). Home page consumes `?restore=` via `RestoreParamSync`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/components/app-shell/app-shell.structure.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shell = readFileSync(new URL("./app-shell.tsx", import.meta.url), "utf8");

describe("AppShell structure", () => {
  it("has a desktop header hidden below lg and a mobile header hidden at lg", () => {
    expect(shell).toContain("hidden border-b border-border bg-card lg:block");
    expect(shell).toContain("lg:hidden");
  });

  it("labels both nav landmarks", () => {
    expect(shell).toContain('aria-label="Primary navigation"');
    expect(shell).toContain('aria-label="Mobile navigation"');
  });

  it("has four bottom tab destinations", () => {
    expect(shell).toContain('href: "/phrasebook"');
    expect(shell).toContain('href: "/history"');
    expect(shell).toContain('href: "/practice"');
    expect(shell).toContain('label: "Saved"');
  });

  it("keeps counts out of accessible names", () => {
    expect(shell).toContain('aria-hidden="true"');
    expect(shell).toContain("{` (${value})`}");
  });

  it("marks the active destination with aria-current", () => {
    expect(shell).toContain('aria-current={active ? "page" : undefined}');
  });

  it("mounts DrawerParamSync inside Suspense and hosts both drawers", () => {
    expect(shell).toContain("<Suspense fallback={null}>");
    expect(shell).toContain("<DrawerParamSync");
    expect(shell).toContain("<PhrasebookDrawer");
    expect(shell).toContain("<HistoryDrawer");
  });

  it("routes drawer restore through the restore search param", () => {
    expect(shell).toContain("/?restore=");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app-shell.structure`
Expected: FAIL — `app-shell.tsx` does not exist.

- [ ] **Step 3: Create AppShell**

Create `apps/web/components/app-shell/app-shell.tsx`:

```tsx
"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bookmark, History, Languages, Zap } from "lucide-react";
import { AuthHeaderActions } from "@/components/auth-header-actions";
import { DrawerParamSync } from "@/components/app-shell/drawer-param-sync";
import { HistoryDrawer } from "@/components/history-drawer";
import { OnboardingSyncHint } from "@/components/onboarding-sync-hint";
import { PhrasebookDrawer } from "@/components/phrasebook-drawer";
import { usePhrasebookHydrated } from "@/lib/stores/use-phrasebook-hydrated";
import { usePhrasebookStore } from "@/lib/stores/phrasebook";

type DrawerId = "phrasebook" | "history";

const LINK_NAV = [
  { label: "Translate", href: "/", icon: Languages },
  { label: "Practice", href: "/practice", icon: Zap },
] as const;

const TABS = [
  { label: "Translate", href: "/", icon: Languages },
  { label: "Practice", href: "/practice", icon: Zap },
  { label: "Saved", href: "/phrasebook", icon: Bookmark },
  { label: "History", href: "/history", icon: History },
] as const;

function Count({ value }: { value: number | null }) {
  if (value === null) return null;
  return <span aria-hidden="true">{` (${value})`}</span>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [openDrawer, setOpenDrawer] = useState<DrawerId | null>(null);
  const hydrated = usePhrasebookHydrated();
  const items = usePhrasebookStore((state) => state.items);
  const getDueCount = usePhrasebookStore((state) => state.getDueCount);
  const getSpeedCount = usePhrasebookStore((state) => state.getSpeedCount);

  const savedCount = hydrated ? items.length : null;
  const practiceCount = hydrated ? getDueCount() + getSpeedCount() : null;

  const openDrawerFromParam = useCallback((drawer: string) => {
    if (drawer === "phrasebook" || drawer === "history") {
      setOpenDrawer(drawer);
    }
  }, []);

  function restoreAndNavigate(id: string) {
    setOpenDrawer(null);
    router.push(`/?restore=${encodeURIComponent(id)}`);
  }

  function chipClass(active: boolean): string {
    return `inline-flex items-center gap-gutter-xs rounded-full px-gutter-md py-gutter-xs text-label-sm transition-colors duration-state-change ease-state-change ${
      active
        ? "bg-primary text-primary-foreground"
        : "border border-border bg-muted text-muted-foreground hover:bg-surface-high"
    }`;
  }

  const mobileCountPill =
    pathname.startsWith("/practice") && practiceCount !== null ? (
      <span className="shrink-0 rounded-full bg-muted px-gutter-sm py-gutter-xs text-label-sm text-muted-foreground tabular-nums">
        {practiceCount} due
      </span>
    ) : pathname === "/phrasebook" && savedCount !== null ? (
      <span className="shrink-0 rounded-full bg-muted px-gutter-sm py-gutter-xs text-label-sm text-muted-foreground tabular-nums">
        {savedCount} saved
      </span>
    ) : null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* Desktop header */}
      <header className="hidden border-b border-border bg-card lg:block">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-gutter-md px-gutter-lg py-gutter-md">
          <Link href="/" className="flex flex-col gap-gutter-xs">
            <span className="font-display text-display-lg-mobile text-foreground xl:text-display-lg">
              Mind Your Language
            </span>
            <span className="text-body-md text-muted-foreground">
              From solid intermediate to natural fluency.
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-gutter-sm">
            <nav
              aria-label="Primary navigation"
              className="flex flex-wrap items-center gap-gutter-sm"
            >
              {LINK_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={chipClass(pathname === item.href)}
                >
                  <item.icon className="size-4" aria-hidden="true" />
                  <span>{item.label}</span>
                  <Count
                    value={item.label === "Practice" ? practiceCount : null}
                  />
                </Link>
              ))}
              <button
                type="button"
                onClick={() => setOpenDrawer("phrasebook")}
                className={chipClass(openDrawer === "phrasebook")}
              >
                <Bookmark className="size-4" aria-hidden="true" />
                <span>Phrasebook</span>
                <Count value={savedCount} />
              </button>
              <button
                type="button"
                onClick={() => setOpenDrawer("history")}
                className={chipClass(openDrawer === "history")}
              >
                <History className="size-4" aria-hidden="true" />
                <span>History</span>
              </button>
            </nav>
            <AuthHeaderActions />
          </div>
        </div>
        <div className="mx-auto w-full max-w-7xl px-gutter-lg">
          <OnboardingSyncHint />
        </div>
      </header>

      {/* Mobile header */}
      <header className="border-b border-border bg-card px-gutter-md py-gutter-sm lg:hidden">
        <div className="flex items-center justify-between gap-gutter-sm">
          <Link href="/" className="flex flex-col">
            <span className="font-display text-display-lg-mobile text-foreground">
              Mind Your Language
            </span>
            <span className="text-body-sm text-muted-foreground">
              Intermediate to natural fluency
            </span>
          </Link>
          {mobileCountPill}
        </div>
        <OnboardingSyncHint />
      </header>

      <div className="flex flex-1 flex-col">{children}</div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Mobile navigation"
        className="sticky bottom-0 z-20 grid grid-cols-4 gap-gutter-xs border-t border-border bg-card px-gutter-sm py-gutter-xs lg:hidden"
      >
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-gutter-xs rounded-md py-gutter-xs text-label-sm transition-colors duration-state-change ease-state-change ${
                active
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <tab.icon className="size-5" aria-hidden="true" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <Suspense fallback={null}>
        <DrawerParamSync onOpenDrawer={openDrawerFromParam} />
      </Suspense>

      <PhrasebookDrawer
        open={openDrawer === "phrasebook"}
        onOpenChange={(open) => setOpenDrawer(open ? "phrasebook" : null)}
        onSelect={(entry) => restoreAndNavigate(entry.id)}
      />
      <HistoryDrawer
        open={openDrawer === "history"}
        onOpenChange={(open) => setOpenDrawer(open ? "history" : null)}
        onSelect={(record) => restoreAndNavigate(record.id)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run shell test, then rewire layout and pages**

Run: `npm test -- app-shell.structure`
Expected: PASS (7 tests).

**`apps/web/app/layout.tsx`:** delete the `AuthHeaderActions` and `OnboardingSyncHint` imports, add `import { AppShell } from "@/components/app-shell/app-shell";`, and replace the entire `<header …>…</header>` block and `{children}` with:

```tsx
<AppShell>{children}</AppShell>
```

**`apps/web/app/practice/page.tsx`:** delete the `<div className="flex flex-wrap items-center justify-between gap-3">…</div>` header block (the "Practice" heading + Translate link) and remove the now-unused `Link` import. Keep everything else.

**`apps/web/app/page.tsx`:**

1. Remove imports: `Link` from `next/link`, `HistoryDrawer`, `PhrasebookDrawer`, and `Button` (all were header/drawer-only).
2. Add imports:

```tsx
import { Suspense } from "react";
import { RestoreParamSync } from "@/components/app-shell/restore-param-sync";
import { findRestoreTarget } from "@/lib/restore-target";
```

(`Suspense` can merge into the existing react import.)
3. Delete state: `historyOpen`, `phrasebookOpen`, `setHistoryOpen`, `setPhrasebookOpen`.
4. Delete the header `<div className="flex flex-wrap items-center justify-between gap-3">…</div>` block and the `<HistoryDrawer … />` + `<PhrasebookDrawer … />` JSX at the bottom.
5. Keep `restoreRecord` and `restorePhrasebook`; add below them:

```tsx
function restoreById(
  id: string,
): "restored" | "pending" | "missing" {
  const target = findRestoreTarget(phrasebookItems, historyItems, id);
  if (target?.kind === "phrasebook") {
    restorePhrasebook(target.entry);
    return "restored";
  }
  if (target?.kind === "history") {
    restoreRecord(target.record);
    return "restored";
  }
  return usePhrasebookStore.persist.hasHydrated() ? "missing" : "pending";
}
```

6. Render the sync as the first child of `<main>`:

```tsx
<Suspense fallback={null}>
  <RestoreParamSync onRestore={restoreById} />
</Suspense>
```

- [ ] **Step 5: Full suite + lint + build**

Run: `npm test`
Expected: PASS (full suite — drawers/store behavior unchanged, just re-hosted).

Run: `npm run lint`
Expected: no errors (watch for unused imports left behind in `page.tsx` / `practice/page.tsx`).

Run: `npm run build`
Expected: succeeds — no `useSearchParams` Suspense errors (both syncs are Suspense-wrapped).

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/app-shell/app-shell.tsx apps/web/components/app-shell/app-shell.structure.test.ts apps/web/app/layout.tsx apps/web/app/page.tsx apps/web/app/practice/page.tsx
git commit -m "feat(shell): unified app shell with chip nav and bottom tab bar"
```

---

### Task 4: Saved & History mobile screens + routes

**Files:**
- Create: `apps/web/components/lists/phrase-list-card.tsx`
- Test: `apps/web/components/lists/phrase-list-card.test.ts`
- Create: `apps/web/components/lists/saved-lists-screen.tsx`
- Create: `apps/web/app/phrasebook/page.tsx`
- Create: `apps/web/app/history/page.tsx`

**Interfaces:**
- Consumes: `useIsDesktop` (Task 2), `filterPhrasebookByTag` + `usePhrasebookStore` (`.items`, `.remove`), `useHistoryStore` (`.items`, `.remove`), `toast` from `sonner`, `Link` from `next/link`.
- Produces:
  - `PhraseListCard({ heading, pinyin?, gloss, meta?, onRestore, onRemove })` — presentational.
  - `SavedListsScreen({ view: "phrasebook" | "history" })`.
  - Routes `/phrasebook` and `/history`: render screen on mobile; on desktop `router.replace("/?drawer=<name>")` (shell opens the drawer, Task 3).

- [ ] **Step 1: Write the failing card test**

Create `apps/web/components/lists/phrase-list-card.test.ts`:

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PhraseListCard } from "./phrase-list-card";

const base = {
  heading: "认识",
  pinyin: "rèn shi",
  gloss: "to meet; to get to know",
  onRestore: () => {},
  onRemove: () => {},
};

describe("PhraseListCard", () => {
  it("renders heading, pinyin, gloss, and a Remove action", () => {
    const html = renderToStaticMarkup(createElement(PhraseListCard, base));
    expect(html).toContain("认识");
    expect(html).toContain('lang="zh-Latn"');
    expect(html).toContain("rèn shi");
    expect(html).toContain("to meet; to get to know");
    expect(html).toContain("Remove");
  });

  it("renders optional meta line when provided", () => {
    const html = renderToStaticMarkup(
      createElement(PhraseListCard, { ...base, meta: "Tags: greeting" }),
    );
    expect(html).toContain("Tags: greeting");
  });

  it("omits the pinyin span when not provided", () => {
    const { pinyin, ...rest } = base;
    const html = renderToStaticMarkup(createElement(PhraseListCard, rest));
    expect(html).not.toContain('lang="zh-Latn"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- phrase-list-card`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement card, screen, and routes**

Create `apps/web/components/lists/phrase-list-card.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";

interface PhraseListCardProps {
  heading: string;
  pinyin?: string;
  gloss: string;
  meta?: string;
  onRestore: () => void;
  onRemove: () => void;
}

export function PhraseListCard({
  heading,
  pinyin,
  gloss,
  meta,
  onRestore,
  onRemove,
}: PhraseListCardProps) {
  return (
    <article className="flex items-start justify-between gap-gutter-sm rounded-lg border border-border bg-card p-gutter-md">
      <button
        type="button"
        onClick={onRestore}
        className="flex min-w-0 flex-1 flex-col gap-gutter-xs text-left"
        aria-label={`Restore ${heading}`}
      >
        <span className="flex flex-wrap items-baseline gap-gutter-sm">
          <span className="text-title-md text-foreground">{heading}</span>
          {pinyin ? (
            <span lang="zh-Latn" className="font-mono text-mono-sm text-pinyin">
              {pinyin}
            </span>
          ) : null}
        </span>
        <span className="text-body-md text-foreground">{gloss}</span>
        {meta ? (
          <span className="text-body-sm text-muted-foreground">{meta}</span>
        ) : null}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0"
        onClick={onRemove}
      >
        Remove
      </Button>
    </article>
  );
}
```

Create `apps/web/components/lists/saved-lists-screen.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PhraseListCard } from "@/components/lists/phrase-list-card";
import { useHistoryStore } from "@/lib/stores/history";
import {
  filterPhrasebookByTag,
  usePhrasebookStore,
} from "@/lib/stores/phrasebook";

function preview(text: string, max = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

interface SavedListsScreenProps {
  view: "phrasebook" | "history";
}

export function SavedListsScreen({ view }: SavedListsScreenProps) {
  const router = useRouter();
  const phrasebookItems = usePhrasebookStore((state) => state.items);
  const removePhrase = usePhrasebookStore((state) => state.remove);
  const historyItems = useHistoryStore((state) => state.items);
  const removeHistory = useHistoryStore((state) => state.remove);
  const [tagFilter, setTagFilter] = useState("");

  const filteredPhrases = useMemo(
    () => filterPhrasebookByTag(phrasebookItems, tagFilter),
    [phrasebookItems, tagFilter],
  );

  function restore(id: string) {
    router.push(`/?restore=${encodeURIComponent(id)}`);
  }

  const tabs = [
    {
      id: "phrasebook" as const,
      label: `Phrasebook (${phrasebookItems.length})`,
      href: "/phrasebook",
    },
    {
      id: "history" as const,
      label: `History (${historyItems.length})`,
      href: "/history",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-gutter-md px-gutter-md py-gutter-md pb-section">
      <div
        role="tablist"
        aria-label="Saved lists"
        className="flex items-center gap-gutter-xs rounded-full bg-muted p-gutter-xs"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={view === tab.id}
            className={`flex-1 rounded-full py-gutter-xs text-center text-label-sm tabular-nums transition-colors duration-state-change ease-state-change ${
              view === tab.id
                ? "bg-card text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {view === "phrasebook" ? (
        <input
          type="text"
          value={tagFilter}
          onChange={(event) => setTagFilter(event.target.value)}
          placeholder="Filter by tag..."
          aria-label="Filter by tag"
          className="w-full rounded-full border border-border bg-card px-gutter-md py-gutter-xs text-body-sm text-foreground placeholder:text-muted-foreground"
        />
      ) : null}

      {view === "phrasebook" ? (
        filteredPhrases.length === 0 ? (
          <p className="text-body-md text-muted-foreground">
            {phrasebookItems.length === 0
              ? "Nothing saved yet — translate something and save it."
              : "No phrases match this tag filter."}
          </p>
        ) : (
          <div className="flex flex-col gap-gutter-sm">
            {filteredPhrases.map((item) => (
              <PhraseListCard
                key={item.id}
                heading={preview(item.translation, 40)}
                pinyin={item.pinyin}
                gloss={preview(item.sourceText)}
                meta={
                  item.tags.length > 0
                    ? `Tags: ${item.tags.join(", ")}`
                    : undefined
                }
                onRestore={() => restore(item.id)}
                onRemove={() => {
                  removePhrase(item.id);
                  toast.success("Removed from phrasebook");
                }}
              />
            ))}
          </div>
        )
      ) : historyItems.length === 0 ? (
        <p className="text-body-md text-muted-foreground">
          No translations yet — they appear here after you translate.
        </p>
      ) : (
        <div className="flex flex-col gap-gutter-sm">
          {historyItems.map((item) => (
            <PhraseListCard
              key={item.id}
              heading={preview(item.translation, 40)}
              pinyin={item.pinyin}
              gloss={preview(item.sourceText)}
              onRestore={() => restore(item.id)}
              onRemove={() => {
                removeHistory(item.id);
                toast.success("Removed from history");
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
```

Create `apps/web/app/phrasebook/page.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsDesktop } from "@/components/app-shell/use-is-desktop";
import { SavedListsScreen } from "@/components/lists/saved-lists-screen";

export default function PhrasebookPage() {
  const router = useRouter();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (isDesktop) {
      router.replace("/?drawer=phrasebook");
    }
  }, [isDesktop, router]);

  if (isDesktop) return null;

  return (
    <div className="lg:hidden">
      <SavedListsScreen view="phrasebook" />
    </div>
  );
}
```

Create `apps/web/app/history/page.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsDesktop } from "@/components/app-shell/use-is-desktop";
import { SavedListsScreen } from "@/components/lists/saved-lists-screen";

export default function HistoryPage() {
  const router = useRouter();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (isDesktop) {
      router.replace("/?drawer=history");
    }
  }, [isDesktop, router]);

  if (isDesktop) return null;

  return (
    <div className="lg:hidden">
      <SavedListsScreen view="history" />
    </div>
  );
}
```

- [ ] **Step 4: Run tests, lint, build**

Run: `npm test`
Expected: PASS (card tests + full suite).

Run: `npm run lint && npm run build`
Expected: clean; build succeeds (two new routes compile).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/lists apps/web/app/phrasebook apps/web/app/history
git commit -m "feat(lists): saved/history mobile screens behind new routes"
```

---

### Task 5: Shell e2e coverage

**Files:**
- Create: `apps/web/e2e/app-shell.spec.ts`

**Interfaces:**
- Consumes: nav contract from Task 3; screens from Task 4. Existing specs (`practice.spec.ts`, `history-phrasebook.spec.ts`, `learnables.spec.ts`, `sync-auth.spec.ts`, `practice-chunks.spec.ts`) must keep passing unchanged — the aria-hidden-count rule exists for them.

- [ ] **Step 1: Write the e2e spec**

Create `apps/web/e2e/app-shell.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test.describe('app shell — desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('chip nav links to practice', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Practice' }).click()
    await expect(page).toHaveURL(/\/practice$/)
  })

  test('phrasebook chip opens the drawer', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Phrasebook' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('desktop /phrasebook redirects to the drawer', async ({ page }) => {
    await page.goto('/phrasebook')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

test.describe('app shell — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('bottom tab bar navigates to the saved screen', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Saved' }).click()
    await expect(page).toHaveURL(/\/phrasebook$/)
    await expect(page.getByText('Nothing saved yet')).toBeVisible()
  })

  test('switcher moves between phrasebook and history', async ({ page }) => {
    await page.goto('/phrasebook')
    await page.getByRole('tab', { name: /History/ }).click()
    await expect(page).toHaveURL(/\/history$/)
    await expect(page.getByText('No translations yet')).toBeVisible()
  })

  test('history screen restores onto the translate page', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem(
        'myl-history',
        JSON.stringify({
          state: {
            items: [
              {
                id: 'e2e-h1',
                userId: null,
                sourceText: 'hello world',
                sourceLang: 'en',
                targetLang: 'zh',
                translation: '你好世界',
                characterSet: 'simplified',
                dictionaryMatches: [],
                segments: [],
                createdAt: new Date().toISOString(),
              },
            ],
          },
          version: 0,
        }),
      )
    })
    await page.goto('/history')
    await page.getByRole('button', { name: 'Restore 你好世界' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByTestId('result-translation')).toContainText('你好世界')
  })
})
```

Note for the implementer: the persisted-store key is `myl-history` (see `apps/web/lib/stores/history.ts`). If the persist config has a `version`, match it — check the store file first.

- [ ] **Step 2: Run the new spec**

Run: `npm run test:e2e -- app-shell`
Expected: PASS (6 tests). The dev server starts via the existing Playwright config.

- [ ] **Step 3: Run the whole e2e suite**

Run: `npm run test:e2e`
Expected: PASS — existing specs (translate, practice, history-phrasebook, learnables, practice-chunks, persistence, sync-auth) still green thanks to aria-hidden counts.

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/app-shell.spec.ts
git commit -m "test(shell): e2e coverage for shell nav and mobile screens"
```

---

## Done-when (phase acceptance)

1. `npm test`, `npm run lint`, `npm run build` — all green.
2. `npm run test:e2e` — full suite green, including the 6 new shell tests.
3. Desktop: unified header with jade active chip; Phrasebook/History open drawers; old per-page headers gone.
4. Mobile: bottom tab bar navigates all four destinations; Saved/History render real screens with Remove + restore-on-tap.
