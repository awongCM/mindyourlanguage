"use client";

import { Bookmark } from "lucide-react";
import { LearnableItem } from "@/components/learnables/learnable-item";
import { LearnableLoadingCard } from "@/components/learnables/learnable-loading-card";
import { useKeyedSelection } from "@/components/learnables/use-keyed-selection";
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
  const selection = useKeyedSelection(items.map((item) => item.chinese));

  if (loading) return <LearnableLoadingCard />;
  if (items.length === 0) return null;

  const selectedItems = selection.selectedItems(items, (item) => item.chinese);

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
              checked={selection.has(item.chinese)}
              characterSet={characterSet}
              onToggle={() => selection.toggle(item.chinese)}
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
