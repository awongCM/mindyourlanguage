"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RestoreParamSync } from "@/components/app-shell/restore-param-sync";
import { useLearnableSuggestions } from "@/components/learnables/use-learnable-suggestions";
import { usePracticeChunks } from "@/components/practice-chunks/use-practice-chunks";
import {
  MIN_CHUNKABLE_ZH_CHARS,
  zhCharLength,
} from "@/lib/practice/chunk-lock";
import type { PracticeChunkParentInput } from "@/lib/practice-chunks";
import { ResultCard } from "@/components/result-card";
import { ComposerCard } from "@/components/translate/composer-card";
import { ReadingPassage } from "@/components/translate/reading-passage";
import {
  StudyPanel,
  type StudyTabId,
} from "@/components/translate/study-panel";
import type { TranslateDirection } from "@/components/translator-form";
import {
  createInitialPracticeStats,
} from "@/lib/practice/srs";
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
import { cancelSpeech } from "@/lib/speech";
import { findRestoreTarget } from "@/lib/restore-target";
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
    segments: entry.segments ?? [],
    dictionaryMatches: entry.dictionaryMatches ?? [],
    nativeAlternative: entry.nativeAlternative,
    register: entry.register,
    nativeNote: entry.nativeNote,
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
  const [sourceText, setSourceText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TranslateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [studyTab, setStudyTab] = useState<StudyTabId>("dictionary");
  const [activeEntry, setActiveEntry] = useState<{
    key: string;
    source: "passage" | "panel";
  } | null>(null);

  const addHistory = useHistoryStore((state) => state.add);
  const historyItems = useHistoryStore((state) => state.items);
  const restoredLatestRef = useRef(false);
  const phrasebookItems = usePhrasebookStore((state) => state.items);
  const addPhrasebook = usePhrasebookStore((state) => state.add);
  const removePhrasebook = usePhrasebookStore((state) => state.remove);

  const learnables = useLearnableSuggestions(voiceRegion, characterSet);
  const practiceChunks = usePracticeChunks(voiceRegion, characterSet);

  const isEnglishToChinese =
    direction.sourceLang === "en" && direction.targetLang === "zh";
  const isChineseToEnglish =
    direction.sourceLang === "zh" && direction.targetLang === "en";
  const showPlayButtons =
    direction.sourceLang === "zh" || direction.targetLang === "zh";
  const resultLayout = isChineseToEnglish ? "chinese-source" : "chinese-target";

  const currentPhrasebookCandidate = result
    ? {
        translationId: result.id,
        sourceText,
        translation: result.translation,
      }
    : null;

  const isSaved =
    currentPhrasebookCandidate !== null &&
    phrasebookItems.some((item) =>
      entryMatchesSaved(item, currentPhrasebookCandidate),
    );

  const availableTabs = useMemo<StudyTabId[]>(() => {
    if (!result) return [];
    const tabs: StudyTabId[] = [];
    if (isEnglishToChinese && practiceChunks.visible) tabs.push("chunks");
    if (isEnglishToChinese && learnables.visible) tabs.push("learnables");
    if (result.dictionaryMatches.length > 0) tabs.push("dictionary");
    return tabs;
  }, [result, isEnglishToChinese, practiceChunks.visible, learnables.visible]);

  // Keep the selected tab valid as results and suggestions come and go.
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(studyTab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derive a valid tab from async availability
      setStudyTab(availableTabs[0]);
    }
  }, [availableTabs, studyTab]);

  // Clamp for render so the tablist always has a tabbable tab.
  const effectiveStudyTab = availableTabs.includes(studyTab)
    ? studyTab
    : (availableTabs[0] ?? studyTab);

  const studyCounts: Record<StudyTabId, number> = {
    chunks: practiceChunks.items.length,
    learnables: learnables.items.length,
    dictionary: result?.dictionaryMatches.length ?? 0,
  };

  function handleActivateFromPassage(key: string) {
    setActiveEntry({ key, source: "passage" });
    setStudyTab("dictionary");
  }

  function handleActivateFromPanel(key: string | null) {
    setActiveEntry(key ? { key, source: "panel" } : null);
  }

  function handleRetryChunks() {
    if (!result || !sourceText.trim()) return;
    void practiceChunks.load(sourceText, result.translation);
  }

  function buildParentFieldsFromResult(): PracticeChunkParentInput | null {
    if (!result || !sourceText.trim()) return null;

    const candidate = {
      translationId: result.id,
      sourceText,
      translation: result.translation,
    };
    const existing = phrasebookItems.find((item) =>
      entryMatchesSaved(item, candidate),
    );

    return {
      id: existing?.id,
      translationId: result.id,
      sourceText,
      sourceLang: direction.sourceLang,
      targetLang: direction.targetLang,
      translation: result.translation,
      traditional: result.traditional,
      pinyin: result.pinyin,
      characterSet,
      register: result.register,
      nativeAlternative: result.nativeAlternative,
      nativeNote: result.nativeNote,
      dictionaryMatches: result.dictionaryMatches,
      segments: result.segments,
      practiceStats: existing?.practiceStats ?? createInitialPracticeStats(),
    };
  }

  function restoreRecord(record: TranslationRecord) {
    learnables.clear();
    practiceChunks.clear();
    setActiveEntry(null);
    setDirection({
      sourceLang: record.sourceLang,
      targetLang: record.targetLang,
    });
    setCharacterSet(record.characterSet);
    setSourceText(record.sourceText);
    setResult(translationRecordToResponse(record));
    setError(null);
  }

  // Put the newest saved translation back after a refresh, once, and only if
  // the user has not typed or translated anything yet.
  useEffect(() => {
    if (restoredLatestRef.current) return;
    const latest = historyItems[0];
    if (!latest) return;
    restoredLatestRef.current = true;
    if (result !== null || sourceText.trim() !== "") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of persisted history
    restoreRecord(latest);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once from the first history snapshot
  }, [historyItems]);

  function restorePhrasebook(entry: PhrasebookEntry) {
    learnables.clear();
    practiceChunks.clear();
    setActiveEntry(null);
    setDirection({
      sourceLang: entry.sourceLang,
      targetLang: entry.targetLang,
    });
    setCharacterSet(entry.characterSet);
    setSourceText(entry.sourceText);
    setResult(phrasebookEntryToResponse(entry));
    setError(null);
  }

  function restoreById(id: string): "restored" | "pending" | "missing" {
    const target = findRestoreTarget(phrasebookItems, historyItems, id);
    if (target?.kind === "phrasebook") {
      // An explicit restore wins over the one-time "latest history" restore.
      restoredLatestRef.current = true;
      restorePhrasebook(target.entry);
      return "restored";
    }
    if (target?.kind === "history") {
      restoredLatestRef.current = true;
      restoreRecord(target.record);
      return "restored";
    }
    return usePhrasebookStore.persist.hasHydrated() ? "missing" : "pending";
  }

  function handleClear() {
    cancelSpeech();
    learnables.clear();
    practiceChunks.clear();
    setActiveEntry(null);
    setSourceText("");
    setResult(null);
    setError(null);
  }

  function buildFullPhraseEntry() {
    if (!result) return null;
    return createPhrasebookEntry({
      translationId: result.id,
      sourceText,
      sourceLang: direction.sourceLang,
      targetLang: direction.targetLang,
      translation: result.translation,
      traditional: result.traditional,
      pinyin: result.pinyin,
      characterSet,
      register: result.register,
      nativeAlternative: result.nativeAlternative,
      nativeNote: result.nativeNote,
      dictionaryMatches: result.dictionaryMatches,
      segments: result.segments,
      practiceStats: createInitialPracticeStats(),
    });
  }

  function handleToggleSave() {
    if (!result || !sourceText.trim()) return;

    const candidate = {
      translationId: result.id,
      sourceText,
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

    const entry = buildFullPhraseEntry();
    if (!entry) return;
    addPhrasebook(entry);
    toast.success("Saved to phrasebook");
  }

  // Save-only: never removes an already-saved phrase (or its practice history).
  function handleSaveFull() {
    if (!result || !sourceText.trim()) return;

    if (isSaved) {
      toast.info("Already in phrasebook");
      return;
    }

    const entry = buildFullPhraseEntry();
    if (!entry) return;
    addPhrasebook(entry);
    toast.success("Saved to phrasebook");
  }

  async function handleTranslate(text: string) {
    setIsLoading(true);
    setError(null);
    learnables.clear();
    practiceChunks.clear();
    setActiveEntry(null);

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
      setSourceText(text);
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

      if (isEnglishToChinese) {
        void learnables.load(
          text,
          data.translation,
          phrasebookItems.map((item) => item.translation),
        );
        if (zhCharLength(data.translation) >= MIN_CHUNKABLE_ZH_CHARS) {
          void practiceChunks.load(text, data.translation);
        }
      }
    } catch {
      setError("Translation service unavailable. Try again.");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto grid w-full min-w-0 max-w-7xl flex-1 gap-6 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:grid-cols-12">
      <Suspense fallback={null}>
        <RestoreParamSync onRestore={restoreById} />
      </Suspense>

      <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
        <ComposerCard
          characterSet={characterSet}
          onCharacterSetChange={setCharacterSet}
          voiceRegion={voiceRegion}
          onVoiceRegionChange={setVoiceRegion}
          sourceText={sourceText}
          onSourceTextChange={setSourceText}
          onSubmit={handleTranslate}
          onClear={handleClear}
          isLoading={isLoading}
          direction={direction}
          onDirectionChange={setDirection}
          showNativeAlternative={isEnglishToChinese}
          includeNativeAlternative={includeNativeAlternative}
          onIncludeNativeAlternativeChange={setIncludeNativeAlternative}
        />

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {result ? (
          <>
            <ResultCard
              key={result.id}
              result={result}
              characterSet={characterSet}
              layout={resultLayout}
              sourceText={sourceText}
              showPlayButtons={showPlayButtons}
              voiceRegion={voiceRegion}
              isSaved={isSaved}
              onToggleSave={handleToggleSave}
              phrasebookHint={
                isEnglishToChinese &&
                (learnables.visible || practiceChunks.visible)
                  ? "Save the full phrase, or pick chunks and new bits in the study panel."
                  : undefined
              }
            />
            {isEnglishToChinese && result ? (
              <ReadingPassage
                text={
                  characterSet === "traditional" && result.traditional
                    ? result.traditional
                    : result.translation
                }
                pinyin={result.pinyin}
                entries={result.dictionaryMatches}
                activeEntryKey={activeEntry?.key ?? null}
                onActivateEntry={handleActivateFromPassage}
              />
            ) : null}
          </>
        ) : null}
      </div>

      <div className="min-w-0 lg:col-span-5">
        {result && availableTabs.length > 0 ? (
          <div className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
            <StudyPanel
              availableTabs={availableTabs}
              tab={effectiveStudyTab}
              onTabChange={setStudyTab}
              counts={studyCounts}
              characterSet={characterSet}
              chunksLoading={practiceChunks.loading}
              chunksSuggestEmpty={practiceChunks.suggestEmpty}
              chunkItems={practiceChunks.items}
              onSaveChunksSelected={(selected) => {
                const parent = buildParentFieldsFromResult();
                if (!parent) return;
                practiceChunks.saveSelected(selected, parent);
              }}
              onSaveFullOnly={handleSaveFull}
              onRetryChunks={handleRetryChunks}
              learnablesLoading={learnables.loading}
              learnableItems={learnables.items}
              onSaveLearnablesSelected={learnables.saveSelected}
              dictionaryEntries={result.dictionaryMatches}
              activeEntryKey={activeEntry?.key ?? null}
              activeEntrySource={activeEntry?.source ?? null}
              onActivateEntry={handleActivateFromPanel}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
