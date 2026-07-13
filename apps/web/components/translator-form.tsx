"use client";

import { useState } from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Lang } from "@mindyourlanguage/shared";

const MAX_CHARS = 500;

export interface TranslateDirection {
  sourceLang: Lang;
  targetLang: Lang;
}

interface TranslatorFormProps {
  onSubmit: (text: string) => void;
  isLoading: boolean;
  direction: TranslateDirection;
  onDirectionChange: (direction: TranslateDirection) => void;
}

function langLabel(lang: Lang): string {
  return lang === "en" ? "EN" : "ZH";
}

export function TranslatorForm({
  onSubmit,
  isLoading,
  direction,
  onDirectionChange,
}: TranslatorFormProps) {
  const [text, setText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const charCount = text.length;
  const trimmed = text.trim();

  function swapDirection() {
    onDirectionChange({
      sourceLang: direction.targetLang,
      targetLang: direction.sourceLang,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!trimmed) {
      setValidationError("Enter text to translate");
      return;
    }

    if (charCount > MAX_CHARS) {
      setValidationError(`Text exceeds ${MAX_CHARS} characters (${charCount})`);
      return;
    }

    setValidationError(null);
    onSubmit(trimmed);
  }

  function handleChange(value: string) {
    setText(value);
    if (validationError) {
      if (!value.trim()) {
        setValidationError("Enter text to translate");
      } else if (value.length > MAX_CHARS) {
        setValidationError(
          `Text exceeds ${MAX_CHARS} characters (${value.length})`,
        );
      } else {
        setValidationError(null);
      }
    }
  }

  const overLimit = charCount > MAX_CHARS;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {langLabel(direction.sourceLang)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={swapDirection}
          aria-label="Swap translation direction"
          disabled={isLoading}
        >
          <ArrowLeftRight />
        </Button>
        <span className="text-sm font-medium text-foreground">
          {langLabel(direction.targetLang)}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Textarea
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Enter text to translate…"
          rows={4}
          disabled={isLoading}
          aria-invalid={!!validationError || overLimit}
          aria-describedby="char-count validation-error"
        />
        <div className="flex items-center justify-between gap-2">
          <p
            id="validation-error"
            role={validationError ? "alert" : undefined}
            className="text-sm text-destructive"
          >
            {validationError ?? ""}
          </p>
          <p
            id="char-count"
            className={`text-xs tabular-nums ${
              overLimit ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {charCount}/{MAX_CHARS}
          </p>
        </div>
      </div>

      <Button type="submit" disabled={isLoading} className="self-start">
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" />
            Translating…
          </>
        ) : (
          "Translate"
        )}
      </Button>
    </form>
  );
}
