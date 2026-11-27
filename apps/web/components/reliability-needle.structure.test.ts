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
