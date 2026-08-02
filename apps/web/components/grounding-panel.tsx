"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getVisibleGroundingEntries,
  GROUNDING_PREVIEW_COUNT,
} from "@/lib/dictionary-grounding";
import type { DictionaryEntry } from "@mindyourlanguage/shared";

interface GroundingPanelProps {
  entries: DictionaryEntry[];
}

export function GroundingPanel({ entries }: GroundingPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) {
    return (
      <section
        aria-label="Dictionary grounding"
        className="text-sm text-muted-foreground"
      >
        No dictionary matches for this translation.
      </section>
    );
  }

  const visibleEntries = getVisibleGroundingEntries(entries, expanded);
  const hasMore = entries.length > GROUNDING_PREVIEW_COUNT;

  return (
    <section aria-label="Dictionary grounding" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">
          Dictionary grounding
        </h2>
        {hasMore ? (
          <p
            className="text-xs text-muted-foreground"
            data-testid="grounding-count"
          >
            {expanded
              ? `Showing all ${entries.length}`
              : `Showing ${Math.min(GROUNDING_PREVIEW_COUNT, entries.length)} of ${entries.length}`}
          </p>
        ) : null}
      </div>
      <ul className="flex flex-col gap-3">
        {visibleEntries.map((entry) => (
          <li key={`${entry.simplified}-${entry.pinyin}`} className="text-sm">
            <p className="text-foreground">
              <span className="font-medium">{entry.simplified}</span>
              {entry.traditional !== entry.simplified ? (
                <span className="ml-2 text-muted-foreground">
                  {entry.traditional}
                </span>
              ) : null}
              <span className="ml-2 text-muted-foreground" lang="zh-Latn">
                {entry.pinyin}
              </span>
            </p>
            <p className="text-muted-foreground">
              {entry.definitions.join("; ")}
            </p>
          </li>
        ))}
      </ul>
      {hasMore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setExpanded((value) => !value)}
          data-testid="grounding-toggle"
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      ) : null}
    </section>
  );
}
