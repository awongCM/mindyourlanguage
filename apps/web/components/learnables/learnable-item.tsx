"use client";

import { displayForCharacterSet } from "@/lib/characters";
import type {
  CharacterSet,
  LearnableSuggestion,
} from "@mindyourlanguage/shared";

export function LearnableItem({
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
  const id = `learnable-${item.chinese}`;

  return (
    <li className="border-b border-border pb-3 last:border-b-0 last:pb-0">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 size-4 rounded border-foreground/20"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-medium text-foreground">
              {displayForCharacterSet(item.chinese, characterSet)}
            </span>
            <span className="text-sm text-muted-foreground">{item.gloss}</span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {item.kind}
            </span>
          </span>
          <span className="text-sm text-foreground/90">
            {displayForCharacterSet(item.exampleChinese, characterSet)}
          </span>
          <span className="text-sm text-muted-foreground">
            {item.exampleEnglish}
          </span>
        </span>
      </label>
    </li>
  );
}
