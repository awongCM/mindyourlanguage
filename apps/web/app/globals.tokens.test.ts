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