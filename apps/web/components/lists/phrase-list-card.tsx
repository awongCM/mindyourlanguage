"use client";

import { Button } from "@/components/ui/button";

interface PhraseListCardProps {
  heading: string;
  pinyin?: string;
  gloss: string;
  meta?: string;
  onRestore: () => void;
  onRemove: () => void;
}

export function PhraseListCard({
  heading,
  pinyin,
  gloss,
  meta,
  onRestore,
  onRemove,
}: PhraseListCardProps) {
  return (
    <article className="flex items-start justify-between gap-gutter-sm rounded-lg border border-border bg-card p-gutter-md">
      <button
        type="button"
        onClick={onRestore}
        className="flex min-w-0 flex-1 flex-col gap-gutter-xs text-left"
        aria-label={`Restore ${heading}`}
      >
        <span className="flex flex-wrap items-baseline gap-gutter-sm">
          <span className="text-title-md text-foreground">{heading}</span>
          {pinyin ? (
            <span lang="zh-Latn" className="font-mono text-mono-sm text-pinyin">
              {pinyin}
            </span>
          ) : null}
        </span>
        <span className="text-body-md text-foreground">{gloss}</span>
        {meta ? (
          <span className="text-body-sm text-muted-foreground">{meta}</span>
        ) : null}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0"
        onClick={onRemove}
      >
        Remove
      </Button>
    </article>
  );
}