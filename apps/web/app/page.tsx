"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HistoryDrawer } from "@/components/history-drawer";
import { GroundingPanel } from "@/components/grounding-panel";
import { NativeAlternativeCard } from "@/components/native-alternative-card";
import { PhrasebookDrawer } from "@/components/phrasebook-drawer";
import { ResultCard } from "@/components/result-card";
import { Toggles } from "@/components/toggles";
import {
  TranslatorForm,
  type TranslateDirection,
} from "@/components/translator-form";
import { Button } from "@/components/ui/button";
import {
  createPhrasebookEntry,
  entryMatchesSaved,
  usePhrasebookStore,
} from "@/lib/stores/phrasebook";
import { useHistoryStore } from "@/lib/stores/history";
import {
  toTranslationRecord,
  translationRecordToResponse,
} from "@/lib/to-translation-record";
import type {
  CharacterSet,
  PhrasebookEntry,
  TranslateRequest,
  TranslateResponse,
  TranslationRecord,
  VoiceRegion,
} from "@mindyourlanguage/shared";

function phrasebookEntryToResponse(entry: PhrasebookEntry): TranslateResponse {
  return {
    id: entry.translationId ?? entry.id,
    translation: entry.translation,
    traditional: entry.traditional,
    pinyin: entry.pinyin,
    detectedLang: entry.sourceLang,
    segments: [],
    dictionaryMatches: [],
    nativeAlternative: entry.nativeAlternative,
  };
}

export default function Home() {
  const [characterSet, setCharacterSet] =
    useState<CharacterSet>("simplified");
  const [voiceRegion, setVoiceRegion] = useState<VoiceRegion>("zh-CN");
  const [includeNativeAlternative, setIncludeNativeAlternative] =
    useState(true);
  const [direction, setDirection] = useState<TranslateDirection>({
    sourceLang: "en",
    targetLang: "zh",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TranslateResponse | null>(null);
  const [lastSourceText, setLastSourceText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [phrasebookOpen, setPhrasebookOpen] = useState(false);

  const addHistory = useHistoryStore((state) => state.add);
  const phrasebookItems = usePhrasebookStore((state) => state.items);
  const addPhrasebook = usePhrasebookStore((state) => state.add);
  const removePhrasebook = usePhrasebookStore((state) => state.remove);

  const isEnglishToChinese =
    direction.sourceLang === "en" && direction.targetLang === "zh";

  const currentPhrasebookCandidate = result
    ? {
        translationId: result.id,
        sourceText: lastSourceText,
        translation: result.translation,
      }
    : null;

  const isSaved =
    currentPhrasebookCandidate !== null &&
    phrasebookItems.some((item) =>
      entryMatchesSaved(item, currentPhrasebookCandidate),
    );

  function restoreRecord(record: TranslationRecord) {
    setDirection({
      sourceLang: record.sourceLang,
      targetLang: record.targetLang,
    });
    setCharacterSet(record.characterSet);
    setLastSourceText(record.sourceText);
    setResult(translationRecordToResponse(record));
    setError(null);
  }

  function restorePhrasebook(entry: PhrasebookEntry) {
    setDirection({
      sourceLang: entry.sourceLang,
      targetLang: entry.targetLang,
    });
    setCharacterSet(entry.characterSet);
    setLastSourceText(entry.sourceText);
    setResult(phrasebookEntryToResponse(entry));
    setError(null);
  }

  function handleToggleSave() {
    if (!result || !lastSourceText) return;

    const candidate = {
      translationId: result.id,
      sourceText: lastSourceText,
      translation: result.translation,
    };

    if (isSaved) {
      const saved = phrasebookItems.find((item) =>
        entryMatchesSaved(item, candidate),
      );
      if (saved) {
        removePhrasebook(saved.id);
        toast.success("Removed from phrasebook");
      }
      return;
    }

    addPhrasebook(
      createPhrasebookEntry({
        translationId: result.id,
        sourceText: lastSourceText,
        sourceLang: direction.sourceLang,
        targetLang: direction.targetLang,
        translation: result.translation,
        traditional: result.traditional,
        pinyin: result.pinyin,
        characterSet,
        nativeAlternative: result.nativeAlternative,
      }),
    );
    toast.success("Saved to phrasebook");
  }

  async function handleTranslate(text: string) {
    setIsLoading(true);
    setError(null);

    const body: TranslateRequest = {
      text,
      sourceLang: direction.sourceLang,
      targetLang: direction.targetLang,
      characterSet,
      voiceRegion,
      ...(isEnglishToChinese ? { includeNativeAlternative } : {}),
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
      setLastSourceText(text);
      setResult(data);
      addHistory(
        toTranslationRecord({
          response: data,
          sourceText: text,
          sourceLang: direction.sourceLang,
          targetLang: direction.targetLang,
          characterSet,
        }),
      );
    } catch {
      setError("Translation service unavailable. Try again.");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Mind Your Language
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            From solid intermediate to natural fluency.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen(true)}
          >
            History
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPhrasebookOpen(true)}
          >
            Phrasebook
          </Button>
        </div>
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

      {isEnglishToChinese ? (
        <label className="flex w-fit items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={includeNativeAlternative}
            onChange={(event) =>
              setIncludeNativeAlternative(event.target.checked)
            }
            className="size-4 rounded border-foreground/20"
          />
          Native alternative
        </label>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {result ? (
        <>
          <ResultCard
            result={result}
            characterSet={characterSet}
            isSaved={isSaved}
            onToggleSave={handleToggleSave}
          />
          {result.nativeAlternative && result.register ? (
            <NativeAlternativeCard
              alternative={result.nativeAlternative}
              register={result.register}
              note={result.nativeNote}
              characterSet={characterSet}
            />
          ) : null}
          <GroundingPanel entries={result.dictionaryMatches} />
        </>
      ) : null}

      <HistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onSelect={restoreRecord}
      />
      <PhrasebookDrawer
        open={phrasebookOpen}
        onOpenChange={setPhrasebookOpen}
        onSelect={restorePhrasebook}
      />
    </main>
  );
}
