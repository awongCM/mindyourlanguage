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

function zh(text: string, characterSet: CharacterSet): string {
  return characterSet === "traditional" ? toTraditionalChars(text) : text;
}

export function LearnableSuggestionsCard({
  items,
  loading = false,
  characterSet,
  onSaveSelected,
}: LearnableSuggestionsCardProps) {
  const [selected, setSelected] = useState(
    () => new Set(items.map((item) => item.chinese)),
  );

  useEffect(() => {
    setSelected(new Set(items.map((item) => item.chinese)));
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

  return (
    <Card data-testid="learnable-suggestions">
      <CardHeader>
        <CardTitle>New bits to learn</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pick a few new words or short phrases — skip what you already know.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3" aria-label="Learnable suggestions">
          {items.map((item) => {
            const id = `learnable-${item.chinese}`;
            const checked = selected.has(item.chinese);
            return (
              <li
                key={item.chinese}
                className="border-b border-border pb-3 last:border-b-0 last:pb-0"
              >
                <label
                  htmlFor={id}
                  className="flex cursor-pointer items-start gap-3"
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    className="mt-1 size-4 rounded border-foreground/20"
                    onChange={() => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.chinese)) next.delete(item.chinese);
                        else next.add(item.chinese);
                        return next;
                      });
                    }}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className="text-lg font-medium text-foreground">
                        {zh(item.chinese, characterSet)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {item.gloss}
                      </span>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {item.kind}
                      </span>
                    </span>
                    <span className="text-sm text-foreground/90">
                      {zh(item.exampleChinese, characterSet)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {item.exampleEnglish}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
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
