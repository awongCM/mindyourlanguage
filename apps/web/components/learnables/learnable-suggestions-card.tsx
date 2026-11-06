"use client";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { LearnableItem } from "@/components/learnables/learnable-item";
import { LearnableLoadingCard } from "@/components/learnables/learnable-loading-card";
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
  LearnableSuggestion,
} from "@mindyourlanguage/shared";

interface LearnableSuggestionsCardProps {
  items: LearnableSuggestion[];
  loading?: boolean;
  characterSet: CharacterSet;
  onSaveSelected: (items: LearnableSuggestion[]) => void;
}

/** Multi-select a few new learnables, then save the checked ones. */
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

  if (loading) return <LearnableLoadingCard />;
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
      <CardContent>
        <ul className="flex flex-col gap-3" aria-label="Learnable suggestions">
          {items.map((item) => (
            <LearnableItem
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
