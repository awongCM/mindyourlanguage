// apps/web/components/practice-queue-list.tsx
"use client";

import type { PhrasebookEntry } from "@mindyourlanguage/shared";

interface PracticeQueueListProps {
  entries: PhrasebookEntry[];
  currentId: string | null;
  speedReadyIds: ReadonlySet<string>;
  dueIds: ReadonlySet<string>;
  onSelect: (index: number) => void;
}

export function PracticeQueueList({
  entries,
  currentId,
  speedReadyIds,
  dueIds,
  onSelect,
}: PracticeQueueListProps) {
  if (entries.length === 0) return null;

  return (
    <section
      aria-label="All saved queue"
      data-testid="practice-queue-list"
      className="flex flex-col gap-2"
    >
      <h2 className="text-title-md text-foreground">Up next</h2>
      <ul className="flex flex-col gap-2">
        {entries.map((item, index) => {
          const isCurrent = item.id === currentId;
          return (
            <li key={item.id}>
              <button
                type="button"
                data-testid="queue-row"
                data-entry-id={item.id}
                aria-current={isCurrent || undefined}
                onClick={() => onSelect(index)}
                className={`flex w-full flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left transition-colors duration-state-change ease-state-change hover:border-primary/50 ${
                  isCurrent
                    ? "border-primary ring-1 ring-primary"
                    : "border-border"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">
                    {item.translation}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {item.sourceText}
                  </span>
                </span>
                {speedReadyIds.has(item.id) ? (
                  <span
                    data-testid="queue-pill-speed"
                    className="rounded-full bg-secondary px-2 py-0.5 text-label-sm text-secondary-foreground"
                  >
                    Speed ready
                  </span>
                ) : null}
                {dueIds.has(item.id) ? (
                  <span
                    data-testid="queue-pill-due"
                    className="rounded-full bg-warning-container px-2 py-0.5 text-label-sm text-on-warning-container"
                  >
                    Due today
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}