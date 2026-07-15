"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PhrasebookEntry } from "@mindyourlanguage/shared";
import {
  filterPhrasebookByTag,
  usePhrasebookStore,
} from "@/lib/stores/phrasebook";

interface PhrasebookDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (entry: PhrasebookEntry) => void;
}

function preview(text: string, max = 60) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function PhrasebookDrawer({
  open,
  onOpenChange,
  onSelect,
}: PhrasebookDrawerProps) {
  const items = usePhrasebookStore((state) => state.items);
  const update = usePhrasebookStore((state) => state.update);
  const remove = usePhrasebookStore((state) => state.remove);
  const clear = usePhrasebookStore((state) => state.clear);
  const [tagFilter, setTagFilter] = useState("");

  const filteredItems = useMemo(
    () => filterPhrasebookByTag(items, tagFilter),
    [items, tagFilter],
  );

  function handleClear() {
    if (items.length === 0) return;
    if (window.confirm("Clear all saved phrases?")) {
      clear();
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Phrasebook</SheetTitle>
          <SheetDescription>
            Saved phrases with optional tags and notes.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Filter by tag</span>
            <input
              type="text"
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder="greeting"
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
        </div>

        {filteredItems.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">
            {items.length === 0
              ? "No saved phrases yet."
              : "No phrases match this tag filter."}
          </p>
        ) : (
          <ul className="flex flex-1 flex-col gap-3 overflow-y-auto px-4">
            {filteredItems.map((item) => (
              <li key={item.id} className="rounded-md border border-border p-3">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => {
                    onSelect(item);
                    onOpenChange(false);
                  }}
                >
                  <p className="text-sm text-muted-foreground">
                    {preview(item.sourceText)}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {preview(item.translation)}
                  </p>
                </button>

                {item.tags.length > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tags: {item.tags.join(", ")}
                  </p>
                ) : null}

                <label className="mt-2 flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">Notes</span>
                  <textarea
                    value={item.notes}
                    onChange={(event) =>
                      update(item.id, { notes: event.target.value })
                    }
                    rows={2}
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                  />
                </label>

                <label className="mt-2 flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">Tags (comma-separated)</span>
                  <input
                    type="text"
                    value={item.tags.join(", ")}
                    onChange={(event) =>
                      update(item.id, {
                        tags: event.target.value
                          .split(",")
                          .map((tag) => tag.trim())
                          .filter(Boolean),
                      })
                    }
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                  />
                </label>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => remove(item.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={items.length === 0}
          >
            Clear all
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
