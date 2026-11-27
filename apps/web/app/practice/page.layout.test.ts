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

  it("bounds the sticky right column so tall content stays reachable", () => {
    expect(source).toContain("lg:max-h-[calc(100dvh-3rem)]");
    expect(source).toContain("lg:overflow-y-auto");
  });

  it("sticks near the top because the desktop header is not sticky", () => {
    expect(source).toContain("lg:top-6");
    expect(source).not.toContain("lg:top-20");
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

  it("follows the full tab ARIA pattern (ids, controls, roving tabIndex, keys)", () => {
    expect(source).toContain("aria-controls={PRACTICE_PANEL_ID}");
    expect(source).toContain('role="tabpanel"');
    expect(source).toContain("aria-labelledby={`practice-tab-${mode}`}");
    expect(source).toContain("tabIndex={mode ===");
    expect(source).toContain("onKeyDown={handleTabListKeyDown}");
    for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
      expect(source).toContain(`"${key}"`);
    }
  });

  it("renders the queue list in all mode", () => {
    expect(source).toContain("<PracticeQueueList");
    expect(source).toContain('mode === "all"');
  });

  it("no longer uses the old button trio for modes", () => {
    expect(source).not.toContain("variant={mode ===");
  });
});
