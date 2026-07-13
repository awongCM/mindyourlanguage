"use client";

import type { DictionaryEntry } from "@mindyourlanguage/shared";

interface GroundingPanelProps {
  entries: DictionaryEntry[];
}

export function GroundingPanel({ entries }: GroundingPanelProps) {
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

  return (
    <section aria-label="Dictionary grounding" className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-foreground">
        Dictionary grounding
      </h2>
      <ul className="flex flex-col gap-3">
        {entries.map((entry) => (
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
    </section>
  );
}
