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
