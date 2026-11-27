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
    ]) {
      expect(source).toContain(`data-testid="${testid}"`);
    }
    expect(source).toContain('data-testid={`grade-${grade}`}');
    for (const grade of ["again", "hard", "good", "easy"]) {
      expect(source).toContain(`grade: "${grade}"`);
    }
    expect(source).toContain("ShadowingPlayer");
  });
});
