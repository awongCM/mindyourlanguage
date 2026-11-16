"use client";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  CharacterSet,
  PracticeChunkSuggestion,
} from "@mindyourlanguage/shared";

type DraftChunk = PracticeChunkSuggestion & { key: string };

function chunkKey(item: PracticeChunkSuggestion, index: number): string {
  return `${index}::${item.chinese}`;
}

interface PracticeChunksCardProps {
  items: PracticeChunkSuggestion[];
  loading?: boolean;
  characterSet: CharacterSet;
  onSaveSelected: (items: PracticeChunkSuggestion[]) => void;
  onSaveFullOnly?: () => void;
}

export function PracticeChunksCard({
  items,
  loading = false,
  characterSet,
  onSaveSelected,
  onSaveFullOnly,
}: PracticeChunksCardProps) {
  const [drafts, setDrafts] = useState<DraftChunk[]>([]);
  const [selected, setSelected] = useState(() => new Set<string>());

  useEffect(() => {
    const next = items.map((item, index) => ({
      ...item,
      key: chunkKey(item, index),
    }));
    setDrafts(next);
    setSelected(new Set(next.map((item) => item.key)));
  }, [items]);

  if (loading) {
    return (
      <Card data-testid="practice-chunks-loading">
        <CardHeader>
          <CardTitle>Practice chunks</CardTitle>
          <p className="text-sm text-muted-foreground">Suggesting short clauses…</p>
        </CardHeader>
      </Card>
    );
  }

  if (items.length === 0) return null;

  const selectedItems = drafts.filter((item) => selected.has(item.key));
  const canSave =
    selectedItems.length > 0 &&
    selectedItems.every(
      (item) => item.english.trim().length > 0 && item.chinese.trim().length > 0,
    );

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function updateField(
    key: string,
    field: "english" | "chinese",
    value: string,
  ) {
    setDrafts((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }

  return (
    <Card data-testid="practice-chunks">
      <CardHeader>
        <CardTitle>Practice chunks</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pick short clauses to memorize first. The full paragraph unlocks after
          these graduate.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3" aria-label="Practice chunk suggestions">
          {drafts.map((item) => (
            <li
              key={item.key}
              className="flex flex-col gap-2 rounded-lg border border-border p-3"
            >
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={selected.has(item.key)}
                  onChange={() => toggle(item.key)}
                  className="size-4 rounded border-foreground/20"
                />
                Include this chunk
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">English</span>
                <input
                  value={item.english}
                  onChange={(event) =>
                    updateField(item.key, "english", event.target.value)
                  }
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">
                  Chinese ({characterSet})
                </span>
                <input
                  value={item.chinese}
                  onChange={(event) =>
                    updateField(item.key, "chinese", event.target.value)
                  }
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
              </label>
              {item.pinyin ? (
                <p className="text-xs text-muted-foreground">{item.pinyin}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="touch-target-sm"
          disabled={!canSave}
          onClick={() =>
            onSaveSelected(
              selectedItems.map(({ english, chinese, pinyin }) => ({
                english,
                chinese,
                ...(pinyin ? { pinyin } : {}),
              })),
            )
          }
        >
          <Bookmark />
          Save phrase + selected chunks
        </Button>
        {onSaveFullOnly ? (
          <Button
            type="button"
            variant="outline"
            className="touch-target-sm"
            onClick={onSaveFullOnly}
          >
            Save full phrase only
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}