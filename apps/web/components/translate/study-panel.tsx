// apps/web/components/translate/study-panel.tsx
"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { LearnableSuggestionsCard } from "@/components/learnables/learnable-suggestions-card";
import { PracticeChunksCard } from "@/components/practice-chunks/practice-chunks-card";
import { Button } from "@/components/ui/button";
import { displayForCharacterSet } from "@/lib/characters";
import type {
  CharacterSet,
  DictionaryEntry,
  LearnableSuggestion,
  PracticeChunkSuggestion,
} from "@mindyourlanguage/shared";

export type StudyTabId = "chunks" | "learnables" | "dictionary";

const TAB_LABELS: Record<StudyTabId, string> = {
  chunks: "Chunks",
  learnables: "New bits",
  dictionary: "Dictionary",
};

const TAB_DOM_IDS: Record<StudyTabId, string> = {
  chunks: "study-tab-chunks",
  learnables: "study-tab-learnables",
  dictionary: "study-tab-dictionary",
};

const PANEL_DOM_IDS: Record<StudyTabId, string> = {
  chunks: "study-panel-chunks",
  learnables: "study-panel-learnables",
  dictionary: "study-panel-dictionary",
};

export interface StudyPanelProps {
  availableTabs: StudyTabId[];
  tab: StudyTabId;
  onTabChange: (tab: StudyTabId) => void;
  counts: Record<StudyTabId, number>;
  characterSet: CharacterSet;
  chunksLoading: boolean;
  chunksSuggestEmpty: boolean;
  chunkItems: PracticeChunkSuggestion[];
  onSaveChunksSelected: (items: PracticeChunkSuggestion[]) => void;
  onSaveFullOnly: () => void;
  onRetryChunks: () => void;
  learnablesLoading: boolean;
  learnableItems: LearnableSuggestion[];
  onSaveLearnablesSelected: (items: LearnableSuggestion[]) => void;
  dictionaryEntries: DictionaryEntry[];
  activeEntryKey: string | null;
  activeEntrySource: "passage" | "panel" | null;
  onActivateEntry: (key: string | null) => void;
}

function DictionaryCards({
  entries,
  characterSet,
  activeEntryKey,
  onActivateEntry,
}: {
  entries: DictionaryEntry[];
  characterSet: CharacterSet;
  activeEntryKey: string | null;
  onActivateEntry: (key: string | null) => void;
}) {
  const [showTraditional, setShowTraditional] = useState(false);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No dictionary matches for this translation.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          aria-pressed={showTraditional}
          onClick={() => setShowTraditional((value) => !value)}
          className="rounded-full border border-border px-3 py-1 text-label-sm text-muted-foreground transition-colors duration-state-change ease-state-change hover:bg-muted aria-pressed:bg-secondary aria-pressed:text-foreground"
        >
          繁 Traditional
        </button>
      </div>
      <ul className="flex flex-col gap-2" aria-label="Dictionary matches">
        {entries.map((entry) => {
          const active = activeEntryKey === entry.simplified;
          return (
            <li key={entry.simplified} id={`dict-card-${entry.simplified}`}>
              <button
                type="button"
                data-testid="dictionary-card"
                data-active={active || undefined}
                onClick={() => onActivateEntry(active ? null : entry.simplified)}
                className={`w-full rounded-lg border bg-card p-3 text-left transition-colors duration-state-change ease-state-change hover:border-primary/50 ${
                  active
                    ? "border-primary ring-1 ring-primary"
                    : "border-border"
                }`}
              >
                <p className="flex flex-wrap items-baseline gap-2">
                  <span lang="zh" className="text-title-md text-foreground">
                    {displayForCharacterSet(entry.simplified, characterSet)}
                  </span>
                  <span
                    lang="zh-Latn"
                    className="font-mono text-mono-sm text-muted-foreground"
                  >
                    {entry.pinyin}
                  </span>
                </p>
                {showTraditional && entry.traditional !== entry.simplified ? (
                  <p lang="zh-Hant" className="mt-1 text-sm text-muted-foreground">
                    繁 {entry.traditional}
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-muted-foreground">
                  {entry.definitions.join("; ")}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function StudyPanel({
  availableTabs,
  tab,
  onTabChange,
  counts,
  characterSet,
  chunksLoading,
  chunksSuggestEmpty,
  chunkItems,
  onSaveChunksSelected,
  onSaveFullOnly,
  onRetryChunks,
  learnablesLoading,
  learnableItems,
  onSaveLearnablesSelected,
  dictionaryEntries,
  activeEntryKey,
  activeEntrySource,
  onActivateEntry,
}: StudyPanelProps) {
  const tabRefs = useRef<Partial<Record<StudyTabId, HTMLButtonElement | null>>>(
    {},
  );

  function focusTab(id: StudyTabId) {
    tabRefs.current[id]?.focus();
  }

  function handleTabListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      event.key !== "ArrowRight" &&
      event.key !== "ArrowLeft" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    const index = availableTabs.indexOf(tab);
    if (index < 0) return;

    if (event.key === "Home") {
      const first = availableTabs[0];
      onTabChange(first);
      focusTab(first);
      return;
    }
    if (event.key === "End") {
      const last = availableTabs[availableTabs.length - 1];
      onTabChange(last);
      focusTab(last);
      return;
    }

    const delta = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + delta + availableTabs.length) % availableTabs.length;
    const next = availableTabs[nextIndex];
    onTabChange(next);
    focusTab(next);
  }

  // Passage-initiated activation scrolls the matching card into view.
  useEffect(() => {
    if (activeEntrySource !== "passage" || !activeEntryKey) return;
    if (tab !== "dictionary") return;
    document
      .getElementById(`dict-card-${activeEntryKey}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeEntryKey, activeEntrySource, tab]);

  if (availableTabs.length === 0) return null;

  const showChunks = availableTabs.includes("chunks");
  const showLearnables = availableTabs.includes("learnables");
  const showDictionary = availableTabs.includes("dictionary");

  return (
    <section
      aria-label="Study panel"
      data-testid="study-panel"
      className="flex flex-col gap-4 rounded-lg bg-surface-low p-gutter-md"
    >
      <div
        role="tablist"
        aria-label="Study sections"
        className="flex flex-wrap gap-1 rounded-full bg-muted p-1"
        onKeyDown={handleTabListKeyDown}
      >
        {availableTabs.map((id) => (
          <button
            key={id}
            ref={(node) => {
              tabRefs.current[id] = node;
            }}
            type="button"
            role="tab"
            id={TAB_DOM_IDS[id]}
            aria-selected={tab === id}
            aria-controls={PANEL_DOM_IDS[id]}
            tabIndex={tab === id ? 0 : -1}
            data-testid={`study-tab-${id}`}
            onClick={() => onTabChange(id)}
            className={`rounded-full px-3 py-1 text-sm transition-colors duration-state-change ease-state-change ${
              tab === id
                ? "bg-card font-medium text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            {TAB_LABELS[id]} ({counts[id]})
          </button>
        ))}
      </div>

      {showChunks ? (
        <div
          role="tabpanel"
          id={PANEL_DOM_IDS.chunks}
          aria-labelledby={TAB_DOM_IDS.chunks}
          className={tab === "chunks" ? "flex flex-col gap-4" : "hidden"}
        >
          {chunksSuggestEmpty && !chunksLoading ? (
            <div
              role="status"
              data-testid="practice-chunks-empty"
              className="flex flex-col gap-3 rounded-lg bg-warning-container px-4 py-3 text-on-warning-container"
            >
              <p className="text-sm font-medium">
                Practice chunks unavailable — this phrase resisted splitting.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-card"
                  onClick={onRetryChunks}
                >
                  Retry chunks
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-card"
                  onClick={onSaveFullOnly}
                >
                  Save full phrase
                </Button>
              </div>
            </div>
          ) : null}
          <PracticeChunksCard
            items={chunkItems}
            loading={chunksLoading}
            characterSet={characterSet}
            onSaveFullOnly={onSaveFullOnly}
            onSaveSelected={onSaveChunksSelected}
          />
        </div>
      ) : null}
      {showLearnables ? (
        <div
          role="tabpanel"
          id={PANEL_DOM_IDS.learnables}
          aria-labelledby={TAB_DOM_IDS.learnables}
          className={tab === "learnables" ? "flex flex-col gap-4" : "hidden"}
        >
          <LearnableSuggestionsCard
            items={learnableItems}
            loading={learnablesLoading}
            characterSet={characterSet}
            onSaveSelected={onSaveLearnablesSelected}
          />
        </div>
      ) : null}
      {showDictionary ? (
        <div
          role="tabpanel"
          id={PANEL_DOM_IDS.dictionary}
          aria-labelledby={TAB_DOM_IDS.dictionary}
          className={tab === "dictionary" ? "flex flex-col gap-4" : "hidden"}
        >
          <DictionaryCards
            entries={dictionaryEntries}
            characterSet={characterSet}
            activeEntryKey={activeEntryKey}
            onActivateEntry={onActivateEntry}
          />
        </div>
      ) : null}
    </section>
  );
}
