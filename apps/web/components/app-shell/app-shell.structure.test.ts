import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shell = readFileSync(new URL("./app-shell.tsx", import.meta.url), "utf8");

describe("AppShell structure", () => {
  it("has a desktop header hidden below lg and a mobile header hidden at lg", () => {
    expect(shell).toContain("hidden border-b border-border bg-card lg:block");
    expect(shell).toContain("lg:hidden");
  });

  it("labels both nav landmarks", () => {
    expect(shell).toContain('aria-label="Primary navigation"');
    expect(shell).toContain('aria-label="Mobile navigation"');
  });

  it("has four bottom tab destinations", () => {
    expect(shell).toContain('href: "/phrasebook"');
    expect(shell).toContain('href: "/history"');
    expect(shell).toContain('href: "/practice"');
    expect(shell).toContain('label: "Saved"');
  });

  it("keeps counts out of accessible names", () => {
    expect(shell).toContain('aria-hidden="true"');
    expect(shell).toContain("{` (${value})`}");
  });

  it("marks the active destination with aria-current", () => {
    expect(shell).toContain('aria-current={active ? "page" : undefined}');
  });

  it("mounts DrawerParamSync inside Suspense and hosts both drawers", () => {
    expect(shell).toContain("<Suspense fallback={null}>");
    expect(shell).toContain("<DrawerParamSync");
    expect(shell).toContain("<PhrasebookDrawer");
    expect(shell).toContain("<HistoryDrawer");
  });

  it("routes drawer restore through the restore search param", () => {
    expect(shell).toContain("/?restore=");
  });
});
