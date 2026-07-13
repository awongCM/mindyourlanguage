"use client";

import { useState } from "react";
import { ResultCard } from "@/components/result-card";
import { Toggles } from "@/components/toggles";
import {
  TranslatorForm,
  type TranslateDirection,
} from "@/components/translator-form";
import type {
  CharacterSet,
  TranslateRequest,
  TranslateResponse,
  VoiceRegion,
} from "@mindyourlanguage/shared";

export default function Home() {
  const [characterSet, setCharacterSet] =
    useState<CharacterSet>("simplified");
  const [voiceRegion, setVoiceRegion] = useState<VoiceRegion>("zh-CN");
  const [direction, setDirection] = useState<TranslateDirection>({
    sourceLang: "en",
    targetLang: "zh",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TranslateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTranslate(text: string) {
    setIsLoading(true);
    setError(null);

    const body: TranslateRequest = {
      text,
      sourceLang: direction.sourceLang,
      targetLang: direction.targetLang,
      characterSet,
    };

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        if (response.status === 429) {
          setError("Too many requests. Wait a moment.");
          setResult(null);
          return;
        }
        if (response.status === 502) {
          setError("Translation service unavailable. Try again.");
          setResult(null);
          return;
        }

        let message = "Translation failed. Try again.";
        try {
          const data = (await response.json()) as { error?: string };
          if (data.error) {
            message = data.error;
          }
        } catch {
          // ignore JSON parse errors
        }
        setError(message);
        setResult(null);
        return;
      }

      const data = (await response.json()) as TranslateResponse;
      setResult(data);
    } catch {
      setError("Translation service unavailable. Try again.");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Mind Your Language
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          From solid intermediate to natural fluency.
        </p>
      </div>

      <Toggles
        characterSet={characterSet}
        onCharacterSetChange={setCharacterSet}
        voiceRegion={voiceRegion}
        onVoiceRegionChange={setVoiceRegion}
      />

      <TranslatorForm
        onSubmit={handleTranslate}
        isLoading={isLoading}
        direction={direction}
        onDirectionChange={setDirection}
      />

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {result ? (
        <ResultCard result={result} characterSet={characterSet} />
      ) : null}
    </main>
  );
}
