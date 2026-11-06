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
import { toTraditionalChars } from "@/lib/characters";
import type {
  CharacterSet,
  LearnableSuggestion,
} from "@mindyourlanguage/shared";

interface LearnableSuggestionsCardProps {
  items: LearnableSuggestion[];
  loading?: boolean;
  characterSet: CharacterSet;
  onSaveSelected: (items: LearnableSuggestion[]) => void;
}

function displayChinese(text: string, characterSet: CharacterSet): string {
  return characterSet === "traditional" ? toTraditionalChars(text) : text;
}

function chineseKeys(items: LearnableSuggestion[]): Set<string> {
  return new Set(items.map((item) => item.chinese));
}

function LearnableRow({
  item,
  checked,
  characterSet,
  onToggle,
}: {
  item: LearnableSuggestion;
  checked: boolean;
  characterSet: CharacterSet;
  onToggle: () => void;
}) {
  const inputId = `learnable-${item.chinese}`;

  return (
    <li className="flex flex-col gap-1 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <label htmlFor={inputId} className="flex cursor-pointer items-start gap-3">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 size-4 rounded border-foreground/20"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-medium text-foreground">
              {displayChinese(item.chinese, characterSet)}
            </span>
            <span className="text-sm text-muted-foreground">{item.gloss}</span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {item.kind}
            </span>
          </span>
          <span className="text-sm text-foreground/90">
            {displayChinese(item.exampleChinese, characterSet)}
          </span>
          <span className="text-sm text-muted-foreground">
            {item.exampleEnglish}
          </span>
        </span>
      </label>
    </li>
  );
}

export function LearnableSuggestionsCard({
  items,
  loading = false,
  characterSet,
  onSaveSelected,
}: LearnableSuggestionsCardProps) {
  const [selected, setSelected] = useState(() => chineseKeys(items));

  useEffect(() => {
    setSelected(chineseKeys(items));
  }, [items]);

  if (loading) {
    return (
      <Card data-testid="learnable-suggestions">
        <CardHeader>
          <CardTitle>New bits to learn</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Finding new bits to learn…
          </p>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) return null;

  const selectedItems = items.filter((item) => selected.has(item.chinese));

  function toggle(chinese: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(chinese)) next.delete(chinese);
      else next.add(chinese);
      return next;
    });
  }

  return (
    <Card data-testid="learnable-suggestions">
      <CardHeader>
        <CardTitle>New bits to learn</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pick a few new words or short phrases — skip what you already know.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col gap-3" aria-label="Learnable suggestions">
          {items.map((item) => (
            <LearnableRow
              key={item.chinese}
              item={item}
              checked={selected.has(item.chinese)}
              characterSet={characterSet}
              onToggle={() => toggle(item.chinese)}
            />
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          type="button"
          className="touch-target-sm"
          disabled={selectedItems.length === 0}
          onClick={() => onSaveSelected(selectedItems)}
          data-testid="save-selected-learnables"
        >
          <Bookmark />
          Save selected
        </Button>
      </CardFooter>
    </Card>
  );
}
