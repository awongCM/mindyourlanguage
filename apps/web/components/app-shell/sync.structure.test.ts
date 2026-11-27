import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const restoreSync = readFileSync(
  new URL("./restore-param-sync.tsx", import.meta.url),
  "utf8",
);
const drawerSync = readFileSync(
  new URL("./drawer-param-sync.tsx", import.meta.url),
  "utf8",
);
const isDesktop = readFileSync(
  new URL("./use-is-desktop.ts", import.meta.url),
  "utf8",
);
const hydrated = readFileSync(
  new URL("../../lib/stores/use-phrasebook-hydrated.ts", import.meta.url),
  "utf8",
);

describe("shell sync components", () => {
  it("RestoreParamSync keeps the param while stores are pending", () => {
    expect(restoreSync).toContain("useSearchParams");
    expect(restoreSync).toContain('"restore"');
    expect(restoreSync).toContain('"pending"');
    expect(restoreSync).toContain('result === "restored" || result === "missing"');
    expect(restoreSync).toContain("router.replace");
  });

  it("DrawerParamSync opens only known drawers and strips the param", () => {
    expect(drawerSync).toContain('"drawer"');
    expect(drawerSync).toContain('"phrasebook"');
    expect(drawerSync).toContain('"history"');
    expect(drawerSync).toContain("router.replace");
  });

  it("useIsDesktop tracks the lg breakpoint", () => {
    expect(isDesktop).toContain('"(min-width: 1024px)"');
    expect(isDesktop).toContain("matchMedia");
    expect(isDesktop).toContain("boolean | null");
  });

  it("usePhrasebookHydrated follows the persist hydration pattern", () => {
    expect(hydrated).toContain("usePhrasebookStore.persist.hasHydrated()");
    expect(hydrated).toContain("onFinishHydration");
  });
});
