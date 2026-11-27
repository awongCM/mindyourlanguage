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
