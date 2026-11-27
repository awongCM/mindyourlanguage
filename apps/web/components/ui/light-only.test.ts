import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) =>
  readFileSync(new URL(file, import.meta.url), "utf8");

describe("Light-mode-only primitives", () => {
  it.each(["./button.tsx", "./textarea.tsx", "./toggle.tsx"])(
    "%s has no dark: classes (the .dark token block no longer exists)",
    (file) => {
      expect(read(file)).not.toMatch(/dark:/);
    },
  );

  it("the Toaster is pinned to the light theme", () => {
    const sonner = read("./sonner.tsx");
    expect(sonner).toContain('theme="light"');
    expect(sonner).not.toContain("useTheme");
  });
});
