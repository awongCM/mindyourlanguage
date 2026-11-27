# Scholarly Jade Phase 1 — Token Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-point the entire `apps/web` theme to the Scholarly Jade design system (colors, fonts, spacing, radii, motion, type scale) with zero layout changes, so every existing component restyles automatically.

**Architecture:** Tailwind v4 `@theme` tokens + shadcn CSS variables remapped in one file (`globals.css`); fonts loaded via `next/font/google` in `layout.tsx`. No Stitch Tailwind-CDN classes (`bg-light-*`) are ported — tokens map onto the existing CSS-var layer instead.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4, shadcn/ui, `next/font/google`, Vitest (fs source-assertion tests — house style for CSS/config).

**Design spec:** `docs/superpowers/specs/2026-11-25-scholarly-jade-redesign-design.md` (Phase 1)

## Global Constraints

- Light mode only: remove the `.dark` block and `@custom-variant dark`; do not add any dark tokens.
- Exact Scholarly Jade values (verbatim, do not approximate): primary `#003A30`, background `#F9FAF7`, card `#FFFFFF`, secondary `#D0E4DD` / on `#546761`, muted `#EDEEEC`, muted-foreground `#404946`, border/ring `#C0C8C4` / `#003A30`, destructive `#BA1A1A`, surface-low `#F3F4F2`, surface-high `#E7E8E6`, surface-highest `#E2E3E1`, warning-container `#FEF3C7` / on `#5C3700`, success-container `#DCFCE7` / on `#14532D`, tertiary `#50261D`.
- Spacing (px): gutter-xs 4, gutter-sm 8, gutter-md 16, gutter-lg 24, gutter-xl 32, section 48, page-margin 24.
- Radius (px): xs 2, sm 6, md 8 (buttons/inputs), lg 12 (cards/panels), xl 16, 2xl 24. Never use bare `rounded` — always a sized radius.
- Type scale (px, font-size/line-height): display-lg 36/42, display-lg-mobile 28/34, headline-lg 26/32, headline-md 20/28, title-md 16/24, reading-lg 19/36, body-md 14/22, body-sm 13/20, label-lg 14/20, label-sm 12/16, mono-sm 13/20.
- Fonts: Crimson Pro 600 (`--font-display`), Commissioner 400/500/600 (`--font-sans`), Source Code Pro 500 (`--font-mono`) via `next/font/google`, `subsets: ["latin"]` only (Han characters fall back to system fonts — intended).
- Motion: state-change 120ms ease-out; surface-enter 200ms cubic-bezier(0.2, 0, 0, 1). Provided as utility classes, not transitions baked into tokens.
- **Read `apps/web/AGENTS.md` before touching `app/` files** — this repo runs Next.js 16 with breaking changes; consult `node_modules/next/dist/docs/` when unsure.
- No layout/component restructuring in this phase — only tokens, fonts, and the one card-radius alignment.
- Run all commands from `apps/web` unless stated otherwise.

## File map

| File | Responsibility |
|---|---|
| `apps/web/app/globals.css` | Single source of truth: `:root` palette + `@theme` token mappings + motion utilities |
| `apps/web/app/globals.tokens.test.ts` | fs source-assertion tests for the token layer |
| `apps/web/app/layout.tsx` | Load Crimson Pro / Commissioner / Source Code Pro via `next/font/google`; drop Geist |
| `apps/web/app/layout.fonts.test.ts` | fs source-assertion test for font wiring |
| `apps/web/components/ui/card.tsx` | Card radius aligns to 12px (`rounded-lg`) |
| `apps/web/components/ui/radius.test.ts` | fs source-assertion test for primitive radii |

---

### Task 1: globals.css token remap

**Files:**
- Modify: `apps/web/app/globals.css` (full rewrite)
- Test: `apps/web/app/globals.tokens.test.ts`

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces: CSS-var token layer consumed by every later phase — `--color-surface-low`, `--color-surface-high`, `--color-surface-highest`, `--color-warning-container`, `--color-on-warning-container`, `--color-success-container`, `--color-on-success-container`, `--color-tertiary`, `--color-pinyin`; spacing `*-gutter-xs|sm|md|lg|xl`, `*-section`, `*-page-margin`; type utilities `text-display-lg`, `text-display-lg-mobile`, `text-headline-lg`, `text-headline-md`, `text-title-md`, `text-reading-lg`, `text-body-md`, `text-body-sm`, `text-label-lg`, `text-label-sm`, `text-mono-sm`; font utilities `font-display`, `font-sans`, `font-mono`; motion classes `.duration-state-change`, `.ease-state-change`, `.duration-surface-enter`, `.ease-surface-enter`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/globals.tokens.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

describe("Scholarly Jade token layer", () => {
  it("maps shadcn semantic vars to the jade palette", () => {
    expect(css).toContain("--primary: #003A30;");
    expect(css).toContain("--primary-foreground: #FFFFFF;");
    expect(css).toContain("--background: #F9FAF7;");
    expect(css).toContain("--foreground: #191C1B;");
    expect(css).toContain("--card: #FFFFFF;");
    expect(css).toContain("--secondary: #D0E4DD;");
    expect(css).toContain("--secondary-foreground: #546761;");
    expect(css).toContain("--muted: #EDEEEC;");
    expect(css).toContain("--muted-foreground: #404946;");
    expect(css).toContain("--border: #C0C8C4;");
    expect(css).toContain("--ring: #003A30;");
    expect(css).toContain("--destructive: #BA1A1A;");
  });

  it("adds the surface ladder and semantic containers", () => {
    expect(css).toContain("--surface-low: #F3F4F2;");
    expect(css).toContain("--surface-high: #E7E8E6;");
    expect(css).toContain("--surface-highest: #E2E3E1;");
    expect(css).toContain("--warning-container: #FEF3C7;");
    expect(css).toContain("--on-warning-container: #5C3700;");
    expect(css).toContain("--success-container: #DCFCE7;");
    expect(css).toContain("--on-success-container: #14532D;");
    expect(css).toContain("--tertiary: #50261D;");
    expect(css).toContain("--color-surface-low: var(--surface-low);");
    expect(css).toContain("--color-warning-container: var(--warning-container);");
    expect(css).toContain("--color-pinyin: var(--primary);");
  });

  it("defines the 4px gutter spacing scale", () => {
    expect(css).toContain("--spacing-gutter-xs: 4px;");
    expect(css).toContain("--spacing-gutter-sm: 8px;");
    expect(css).toContain("--spacing-gutter-md: 16px;");
    expect(css).toContain("--spacing-gutter-lg: 24px;");
    expect(css).toContain("--spacing-gutter-xl: 32px;");
    expect(css).toContain("--spacing-section: 48px;");
    expect(css).toContain("--spacing-page-margin: 24px;");
  });

  it("defines the type scale with companion line-heights", () => {
    expect(css).toContain("--text-display-lg: 36px;");
    expect(css).toContain("--text-display-lg--line-height: 42px;");
    expect(css).toContain("--text-display-lg-mobile: 28px;");
    expect(css).toContain("--text-headline-lg: 26px;");
    expect(css).toContain("--text-headline-md: 20px;");
    expect(css).toContain("--text-title-md: 16px;");
    expect(css).toContain("--text-reading-lg: 19px;");
    expect(css).toContain("--text-reading-lg--line-height: 36px;");
    expect(css).toContain("--text-body-md: 14px;");
    expect(css).toContain("--text-body-sm: 13px;");
    expect(css).toContain("--text-label-lg: 14px;");
    expect(css).toContain("--text-label-sm: 12px;");
    expect(css).toContain("--text-mono-sm: 13px;");
  });

  it("defines the radius scale as fixed px values", () => {
    expect(css).toContain("--radius-sm: 6px;");
    expect(css).toContain("--radius-md: 8px;");
    expect(css).toContain("--radius-lg: 12px;");
    expect(css).toContain("--radius-xl: 16px;");
    expect(css).toContain("--radius-2xl: 24px;");
    expect(css).not.toContain("--radius-md: calc(");
  });

  it("provides motion utility classes", () => {
    expect(css).toContain(".duration-state-change");
    expect(css).toContain("120ms");
    expect(css).toContain(".ease-surface-enter");
    expect(css).toContain("cubic-bezier(0.2, 0, 0, 1)");
  });

  it("maps the three font families", () => {
    expect(css).toContain("--font-display: var(--font-display);");
    expect(css).toContain("--font-sans: var(--font-sans);");
    expect(css).toContain("--font-mono: var(--font-mono);");
    expect(css).toContain("--font-heading: var(--font-display);");
  });

  it("is light-mode only", () => {
    expect(css).not.toContain("@custom-variant dark");
    expect(css).not.toContain(".dark {");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- globals.tokens`
Expected: FAIL — multiple `toContain` assertions fail (current palette is neutral oklch, `.dark` block present).

- [ ] **Step 3: Rewrite globals.css with the Scholarly Jade token layer**

Replace the entire contents of `apps/web/app/globals.css` with:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-display: var(--font-display);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-heading: var(--font-display);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --color-surface-low: var(--surface-low);
  --color-surface-high: var(--surface-high);
  --color-surface-highest: var(--surface-highest);
  --color-warning-container: var(--warning-container);
  --color-on-warning-container: var(--on-warning-container);
  --color-success-container: var(--success-container);
  --color-on-success-container: var(--on-success-container);
  --color-tertiary: var(--tertiary);
  --color-pinyin: var(--primary);
  --radius-xs: 2px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-3xl: 28px;
  --radius-4xl: 32px;
  --spacing-gutter-xs: 4px;
  --spacing-gutter-sm: 8px;
  --spacing-gutter-md: 16px;
  --spacing-gutter-lg: 24px;
  --spacing-gutter-xl: 32px;
  --spacing-section: 48px;
  --spacing-page-margin: 24px;
  --text-display-lg: 36px;
  --text-display-lg--line-height: 42px;
  --text-display-lg--letter-spacing: -0.5px;
  --text-display-lg--font-weight: 600;
  --text-display-lg-mobile: 28px;
  --text-display-lg-mobile--line-height: 34px;
  --text-display-lg-mobile--letter-spacing: -0.25px;
  --text-display-lg-mobile--font-weight: 600;
  --text-headline-lg: 26px;
  --text-headline-lg--line-height: 32px;
  --text-headline-lg--letter-spacing: -0.25px;
  --text-headline-lg--font-weight: 600;
  --text-headline-md: 20px;
  --text-headline-md--line-height: 28px;
  --text-headline-md--font-weight: 600;
  --text-title-md: 16px;
  --text-title-md--line-height: 24px;
  --text-title-md--font-weight: 600;
  --text-reading-lg: 19px;
  --text-reading-lg--line-height: 36px;
  --text-reading-lg--letter-spacing: 0.2px;
  --text-body-md: 14px;
  --text-body-md--line-height: 22px;
  --text-body-sm: 13px;
  --text-body-sm--line-height: 20px;
  --text-label-lg: 14px;
  --text-label-lg--line-height: 20px;
  --text-label-lg--font-weight: 500;
  --text-label-sm: 12px;
  --text-label-sm--line-height: 16px;
  --text-label-sm--letter-spacing: 0.2px;
  --text-label-sm--font-weight: 500;
  --text-mono-sm: 13px;
  --text-mono-sm--line-height: 20px;
  --text-mono-sm--font-weight: 500;
}

:root {
  --background: #F9FAF7;
  --foreground: #191C1B;
  --card: #FFFFFF;
  --card-foreground: #191C1B;
  --popover: #FFFFFF;
  --popover-foreground: #191C1B;
  --primary: #003A30;
  --primary-foreground: #FFFFFF;
  --secondary: #D0E4DD;
  --secondary-foreground: #546761;
  --muted: #EDEEEC;
  --muted-foreground: #404946;
  --accent: #D0E4DD;
  --accent-foreground: #546761;
  --destructive: #BA1A1A;
  --border: #C0C8C4;
  --input: #C0C8C4;
  --ring: #003A30;
  --surface-low: #F3F4F2;
  --surface-high: #E7E8E6;
  --surface-highest: #E2E3E1;
  --warning-container: #FEF3C7;
  --on-warning-container: #5C3700;
  --success-container: #DCFCE7;
  --on-success-container: #14532D;
  --tertiary: #50261D;
  --radius: 8px;
  --chart-1: #003A30;
  --chart-2: #50625D;
  --chart-3: #90C2B4;
  --chart-4: #50261D;
  --chart-5: #6B3C32;
  --sidebar: #F9FAF7;
  --sidebar-foreground: #191C1B;
  --sidebar-primary: #003A30;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #EDEEEC;
  --sidebar-accent-foreground: #191C1B;
  --sidebar-border: #C0C8C4;
  --sidebar-ring: #003A30;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}

@layer utilities {
  .pb-safe {
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }
  .touch-target-sm {
    @apply max-sm:min-h-11 max-sm:px-4;
  }
  .break-anywhere {
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .duration-state-change {
    transition-duration: 120ms;
  }
  .ease-state-change {
    transition-timing-function: ease-out;
  }
  .duration-surface-enter {
    transition-duration: 200ms;
  }
  .ease-surface-enter {
    transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }
}
```

Notes for the implementer:
- The `@custom-variant dark (...)` line and the entire `.dark { … }` block are deleted on purpose (light-only decision).
- `--font-sans`, `--font-display`, `--font-mono` are CSS variables that `next/font` defines on `<html>` in Task 2 — the `@theme inline` self-references are correct (same pattern the old file used for `--font-geist-mono`).

- [ ] **Step 4: Run the tests**

Run: `npm test -- globals.tokens`
Expected: PASS (8 tests).

Then the full suite to catch collateral damage: `npm test`
Expected: PASS (all existing tests — no component logic changed).

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/globals.css apps/web/app/globals.tokens.test.ts
git commit -m "feat(theme): remap shadcn tokens to Scholarly Jade palette"
```

---

### Task 2: Crimson Pro / Commissioner / Source Code Pro via next/font

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Test: `apps/web/app/layout.fonts.test.ts`

**Interfaces:**
- Consumes: `--font-display: var(--font-display)` etc. mappings from Task 1's `@theme inline`.
- Produces: `--font-display`, `--font-sans`, `--font-mono` CSS variables on `<html>`; `font-display` utility used by later phases for headings.

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/layout.fonts.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

describe("layout font wiring", () => {
  it("loads Crimson Pro as --font-display", () => {
    expect(source).toContain("Crimson_Pro");
    expect(source).toContain('"--font-display"');
  });

  it("loads Commissioner as --font-sans", () => {
    expect(source).toContain("Commissioner");
    expect(source).toContain('"--font-sans"');
  });

  it("loads Source Code Pro as --font-mono", () => {
    expect(source).toContain("Source_Code_Pro");
    expect(source).toContain('"--font-mono"');
  });

  it("drops the Geist fonts", () => {
    expect(source).not.toContain("Geist");
  });

  it("applies all three font variables to <html>", () => {
    expect(source).toContain("displayFont.variable");
    expect(source).toContain("sansFont.variable");
    expect(source).toContain("monoFont.variable");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- layout.fonts`
Expected: FAIL — `Crimson_Pro` not found; `Geist` still present.

- [ ] **Step 3: Swap the fonts in layout.tsx**

In `apps/web/app/layout.tsx`, replace the font import block:

```tsx
import { Geist, Geist_Mono } from "next/font/google";
```

with:

```tsx
import {
  Commissioner,
  Crimson_Pro,
  Source_Code_Pro,
} from "next/font/google";
```

Replace the two font declarations:

```tsx
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
```

with:

```tsx
const displayFont = Crimson_Pro({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600"],
});

const sansFont = Commissioner({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const monoFont = Source_Code_Pro({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500"],
});
```

Update the `<html>` className from:

```tsx
className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
```

to:

```tsx
className={`${displayFont.variable} ${sansFont.variable} ${monoFont.variable} h-full antialiased`}
```

- [ ] **Step 4: Run tests and a production build**

Run: `npm test -- layout.fonts`
Expected: PASS (5 tests).

Run: `npm run build`
Expected: build succeeds. NOTE: `next/font/google` downloads font files at build time — this step needs network access to `fonts.googleapis.com` / `fonts.gstatic.com`. If the sandbox blocks it, re-run outside the sandbox.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/layout.tsx apps/web/app/layout.fonts.test.ts
git commit -m "feat(theme): load Crimson Pro, Commissioner, Source Code Pro"
```

---

### Task 3: Align shadcn primitive radii (cards to 12px)

**Files:**
- Modify: `apps/web/components/ui/card.tsx`
- Test: `apps/web/components/ui/radius.test.ts`

**Interfaces:**
- Consumes: radius tokens from Task 1 (`rounded-md` = 8px, `rounded-lg` = 12px).
- Produces: card surfaces at the Scholarly Jade 12px panel radius; buttons/inputs stay at 8px (`rounded-md`, unchanged).

- [ ] **Step 1: Write the failing test**

Create `apps/web/components/ui/radius.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const card = readFileSync(new URL("./card.tsx", import.meta.url), "utf8");
const button = readFileSync(new URL("./button.tsx", import.meta.url), "utf8");
const textarea = readFileSync(
  new URL("./textarea.tsx", import.meta.url),
  "utf8",
);

describe("Scholarly Jade primitive radii", () => {
  it("cards use the 12px panel radius (rounded-lg)", () => {
    expect(card).toContain("rounded-lg");
    expect(card).not.toContain("rounded-xl");
  });

  it("buttons keep the 8px control radius (rounded-md)", () => {
    expect(button).toContain("rounded-md");
  });

  it("textareas keep the 8px control radius (rounded-md)", () => {
    expect(textarea).toContain("rounded-md");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- radius`
Expected: FAIL — card.tsx still contains `rounded-xl`.

- [ ] **Step 3: Update card.tsx**

In `apps/web/components/ui/card.tsx`, in the `Card` component's class string, change `rounded-xl` to `rounded-lg`. No other changes.

- [ ] **Step 4: Run tests, lint, and a visual smoke check**

Run: `npm test`
Expected: PASS (full suite).

Run: `npm run lint`
Expected: no errors.

Visual check (manual): `npm run dev`, open `http://localhost:3000` — the page background is warm paper (`#F9FAF7`), the Practice/History/Phrasebook buttons and focus rings are deep jade (`#003A30`), headings render in a serif face (Crimson Pro), and there is no dark-mode styling anywhere.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/card.tsx apps/web/components/ui/radius.test.ts
git commit -m "feat(theme): align card radius to Scholarly Jade 12px panels"
```

---

## Done-when (phase acceptance)

1. `npm test` — full suite green.
2. `npm run lint` — clean.
3. `npm run build` — succeeds (fonts fetched).
4. Visual: the whole app reads as Scholarly Jade (jade actions, paper surfaces, serif headings) with **no layout changes** — that comes in Phase 2+.
