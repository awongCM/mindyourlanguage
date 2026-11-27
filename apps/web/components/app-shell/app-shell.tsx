"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bookmark, History, Languages, Zap } from "lucide-react";
import { AuthHeaderActions } from "@/components/auth-header-actions";
import { DrawerParamSync } from "@/components/app-shell/drawer-param-sync";
import { HistoryDrawer } from "@/components/history-drawer";
import { OnboardingSyncHint } from "@/components/onboarding-sync-hint";
import { PhrasebookDrawer } from "@/components/phrasebook-drawer";
import { usePhrasebookHydrated } from "@/lib/stores/use-phrasebook-hydrated";
import { usePhrasebookStore } from "@/lib/stores/phrasebook";

type DrawerId = "phrasebook" | "history";

const LINK_NAV = [
  { label: "Translate", href: "/", icon: Languages },
  { label: "Practice", href: "/practice", icon: Zap },
] as const;

const TABS = [
  { label: "Translate", href: "/", icon: Languages },
  { label: "Practice", href: "/practice", icon: Zap },
  { label: "Saved", href: "/phrasebook", icon: Bookmark },
  { label: "History", href: "/history", icon: History },
] as const;

function Count({ value }: { value: number | null }) {
  if (value === null) return null;
  return <span aria-hidden="true">{` (${value})`}</span>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [openDrawer, setOpenDrawer] = useState<DrawerId | null>(null);
  const hydrated = usePhrasebookHydrated();
  const items = usePhrasebookStore((state) => state.items);
  const getDueCount = usePhrasebookStore((state) => state.getDueCount);
  const getSpeedCount = usePhrasebookStore((state) => state.getSpeedCount);

  const savedCount = hydrated ? items.length : null;
  const practiceCount = hydrated ? getDueCount() + getSpeedCount() : null;

  const openDrawerFromParam = useCallback((drawer: string) => {
    if (drawer === "phrasebook" || drawer === "history") {
      setOpenDrawer(drawer);
    }
  }, []);

  function restoreAndNavigate(id: string) {
    setOpenDrawer(null);
    router.push(`/?restore=${encodeURIComponent(id)}`);
  }

  function chipClass(active: boolean): string {
    return `inline-flex items-center gap-gutter-xs rounded-full px-gutter-md py-gutter-xs text-label-sm transition-colors duration-state-change ease-state-change ${
      active
        ? "bg-primary text-primary-foreground"
        : "border border-border bg-muted text-muted-foreground hover:bg-surface-high"
    }`;
  }

  const mobileCountPill =
    pathname.startsWith("/practice") && practiceCount !== null ? (
      <span className="shrink-0 rounded-full bg-muted px-gutter-sm py-gutter-xs text-label-sm text-muted-foreground tabular-nums">
        {practiceCount} due
      </span>
    ) : pathname === "/phrasebook" && savedCount !== null ? (
      <span className="shrink-0 rounded-full bg-muted px-gutter-sm py-gutter-xs text-label-sm text-muted-foreground tabular-nums">
        {savedCount} saved
      </span>
    ) : null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* Desktop header */}
      <header className="hidden border-b border-border bg-card lg:block">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-gutter-md px-gutter-lg py-gutter-md">
          <Link href="/" className="flex flex-col gap-gutter-xs">
            <span className="font-display text-display-lg-mobile text-foreground xl:text-display-lg">
              Mind Your Language
            </span>
            <span className="text-body-md text-muted-foreground">
              From solid intermediate to natural fluency.
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-gutter-sm">
            <nav
              aria-label="Primary navigation"
              className="flex flex-wrap items-center gap-gutter-sm"
            >
              {LINK_NAV.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={chipClass(active)}
                  >
                    <item.icon className="size-4" aria-hidden="true" />
                    <span>{item.label}</span>
                    <Count
                      value={item.label === "Practice" ? practiceCount : null}
                    />
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => setOpenDrawer("phrasebook")}
                className={chipClass(openDrawer === "phrasebook")}
              >
                <Bookmark className="size-4" aria-hidden="true" />
                <span>Phrasebook</span>
                <Count value={savedCount} />
              </button>
              <button
                type="button"
                onClick={() => setOpenDrawer("history")}
                className={chipClass(openDrawer === "history")}
              >
                <History className="size-4" aria-hidden="true" />
                <span>History</span>
              </button>
            </nav>
            <AuthHeaderActions />
          </div>
        </div>
        <div className="mx-auto w-full max-w-7xl px-gutter-lg">
          <OnboardingSyncHint />
        </div>
      </header>

      {/* Mobile header */}
      <header className="border-b border-border bg-card px-gutter-md py-gutter-sm lg:hidden">
        <div className="flex items-center justify-between gap-gutter-sm">
          <Link href="/" className="flex flex-col">
            <span className="font-display text-display-lg-mobile text-foreground">
              Mind Your Language
            </span>
            <span className="text-body-sm text-muted-foreground">
              Intermediate to natural fluency
            </span>
          </Link>
          {mobileCountPill}
        </div>
        <OnboardingSyncHint />
      </header>

      <div className="flex flex-1 flex-col">{children}</div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Mobile navigation"
        className="sticky bottom-0 z-20 grid grid-cols-4 gap-gutter-xs border-t border-border bg-card px-gutter-sm py-gutter-xs lg:hidden"
      >
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-gutter-xs rounded-md py-gutter-xs text-label-sm transition-colors duration-state-change ease-state-change ${
                active
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <tab.icon className="size-5" aria-hidden="true" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <Suspense fallback={null}>
        <DrawerParamSync onOpenDrawer={openDrawerFromParam} />
      </Suspense>

      <PhrasebookDrawer
        open={openDrawer === "phrasebook"}
        onOpenChange={(open) => setOpenDrawer(open ? "phrasebook" : null)}
        onSelect={(entry) => restoreAndNavigate(entry.id)}
      />
      <HistoryDrawer
        open={openDrawer === "history"}
        onOpenChange={(open) => setOpenDrawer(open ? "history" : null)}
        onSelect={(record) => restoreAndNavigate(record.id)}
      />
    </div>
  );
}
