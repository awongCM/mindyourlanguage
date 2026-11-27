// apps/web/components/translate/composer-card.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./composer-card.tsx", import.meta.url),
  "utf8",
);
const toggles = readFileSync(
  new URL("../toggles.tsx", import.meta.url),
  "utf8",
);

describe("ComposerCard structure", () => {
  it("composes Toggles, TranslatorForm and the native-alternative checkbox", () => {
    expect(source).toContain("<Toggles");
    expect(source).toContain("<TranslatorForm");
    expect(source).toContain("Native alternative");
  });

  it("hides the native-alternative checkbox unless EN to ZH", () => {
    expect(source).toContain("showNativeAlternative ? (");
  });

  it("renders inside a Card", () => {
    expect(source).toContain('from "@/components/ui/card"');
    expect(source).toContain("<Card");
  });

  it("never mentions Try First", () => {
    expect(source).not.toContain("TryFirst");
    expect(source).not.toContain("Try First");
  });
});

describe("Toggles segmented pills", () => {
  it("uses a rounded sage track", () => {
    expect(toggles).toContain("rounded-full bg-muted p-1");
  });

  it("fills the active segment with primary", () => {
    expect(toggles).toContain("data-[state=on]:bg-primary");
    expect(toggles).toContain("data-[state=on]:text-primary-foreground");
  });
});