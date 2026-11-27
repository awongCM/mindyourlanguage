import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./saved-lists-screen.tsx", import.meta.url),
  "utf8",
);

describe("SavedListsScreen switcher", () => {
  it("is a nav of links marked with aria-current, not a tablist", () => {
    expect(source).toContain('<nav\n        aria-label="Saved lists"');
    expect(source).toContain('aria-current={view === tab.id ? "page" : undefined}');
    expect(source).not.toContain('role="tab');
    expect(source).not.toContain("aria-selected");
  });
});
