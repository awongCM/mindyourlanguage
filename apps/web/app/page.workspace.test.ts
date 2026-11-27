// apps/web/app/page.workspace.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("translate workspace layout", () => {
  it("uses a 12-column grid inside max-w-7xl", () => {
    expect(source).toContain("max-w-7xl");
    expect(source).toContain("lg:grid-cols-12");
    expect(source).toContain("lg:col-span-7");
    expect(source).toContain("lg:col-span-5");
  });

  it("makes the study panel column sticky on desktop", () => {
    expect(source).toContain("lg:sticky");
  });

  it("composes the new workspace components", () => {
    expect(source).toContain("<ComposerCard");
    expect(source).toContain("<ResultCard");
    expect(source).toContain("<ReadingPassage");
    expect(source).toContain("<StudyPanel");
  });

  it("drops the removed panels", () => {
    expect(source).not.toContain("TryFirstPanel");
    expect(source).not.toContain("ComparisonPanel");
    expect(source).not.toContain("NativeAlternativeCard");
    expect(source).not.toContain("GroundingPanel");
    expect(source).not.toContain("tryFirstEnabled");
  });

  it("gates the reading passage to EN-to-ZH results", () => {
    expect(source).toContain("isEnglishToChinese && result ? (");
  });
});
