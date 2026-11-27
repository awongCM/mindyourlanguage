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
