"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TranslationRecord } from "@mindyourlanguage/shared";
import { useHistoryStore } from "@/lib/stores/history";

interface HistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (record: TranslationRecord) => void;
}

function preview(text: string, max = 60) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function HistoryDrawer({
  open,
  onOpenChange,
  onSelect,
}: HistoryDrawerProps) {
  const items = useHistoryStore((state) => state.items);
  const clear = useHistoryStore((state) => state.clear);
  const remove = useHistoryStore((state) => state.remove);

  function handleClear() {
    if (items.length === 0) return;
    if (window.confirm("Clear all translation history?")) {
      clear();
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>History</SheetTitle>
          <SheetDescription>
            Last 50 translations saved on this device.
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">
            No translations yet.
          </p>
        ) : (
          <ul className="flex flex-1 flex-col gap-2 overflow-y-auto px-4">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full rounded-md border border-border p-3 text-left hover:bg-muted"
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1"
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
