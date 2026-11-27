"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PhraseListCard } from "@/components/lists/phrase-list-card";
import { useHistoryStore } from "@/lib/stores/history";
import {
  filterPhrasebookByTag,
  usePhrasebookStore,
} from "@/lib/stores/phrasebook";

function preview(text: string, max = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

interface SavedListsScreenProps {
  view: "phrasebook" | "history";
}

export function SavedListsScreen({ view }: SavedListsScreenProps) {
  const router = useRouter();
  const phrasebookItems = usePhrasebookStore((state) => state.items);
  const removePhrase = usePhrasebookStore((state) => state.remove);
  const historyItems = useHistoryStore((state) => state.items);
  const removeHistory = useHistoryStore((state) => state.remove);
  const [tagFilter, setTagFilter] = useState("");

  const filteredPhrases = useMemo(
    () => filterPhrasebookByTag(phrasebookItems, tagFilter),
    [phrasebookItems, tagFilter],
  );

  function restore(id: string) {
    router.push(`/?restore=${encodeURIComponent(id)}`);
  }

  const tabs = [
    {
      id: "phrasebook" as const,
      label: `Phrasebook (${phrasebookItems.length})`,
      href: "/phrasebook",
    },
    {
      id: "history" as const,
      label: `History (${historyItems.length})`,
      href: "/history",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-gutter-md px-gutter-md py-gutter-md pb-section">
      <nav
        aria-label="Saved lists"
        className="flex items-center gap-gutter-xs rounded-full bg-muted p-gutter-xs"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={view === tab.id ? "page" : undefined}
            className={`flex-1 rounded-full py-gutter-xs text-center text-label-sm tabular-nums transition-colors duration-state-change ease-state-change ${
              view === tab.id
                ? "bg-card text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {view === "phrasebook" ? (
        <input
          type="text"
          value={tagFilter}
          onChange={(event) => setTagFilter(event.target.value)}
          placeholder="Filter by tag..."
          aria-label="Filter by tag"
          className="w-full rounded-full border border-border bg-card px-gutter-md py-gutter-xs text-body-sm text-foreground placeholder:text-muted-foreground"
        />
      ) : null}

      {view === "phrasebook" ? (
        filteredPhrases.length === 0 ? (
          <p className="text-body-md text-muted-foreground">
            {phrasebookItems.length === 0
              ? "Nothing saved yet — translate something and save it."
              : "No phrases match this tag filter."}
          </p>
        ) : (
          <div className="flex flex-col gap-gutter-sm">
            {filteredPhrases.map((item) => (
              <PhraseListCard
                key={item.id}
                heading={preview(item.translation, 40)}
                pinyin={item.pinyin}
                gloss={preview(item.sourceText)}
                meta={
                  item.tags.length > 0
                    ? `Tags: ${item.tags.join(", ")}`
                    : undefined
                }
                onRestore={() => restore(item.id)}
                onRemove={() => {
                  removePhrase(item.id);
                  toast.success("Removed from phrasebook");
                }}
              />
            ))}
          </div>
        )
      ) : historyItems.length === 0 ? (
        <p className="text-body-md text-muted-foreground">
          No translations yet — they appear here after you translate.
        </p>
      ) : (
        <div className="flex flex-col gap-gutter-sm">
          {historyItems.map((item) => (
            <PhraseListCard
              key={item.id}
              heading={preview(item.translation, 40)}
              pinyin={item.pinyin}
              gloss={preview(item.sourceText)}
              onRestore={() => restore(item.id)}
              onRemove={() => {
                removeHistory(item.id);
                toast.success("Removed from history");
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
