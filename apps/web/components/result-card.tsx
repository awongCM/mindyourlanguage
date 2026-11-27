"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Bookmark, Check, ChevronDown, Copy, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { displayForCharacterSet } from "@/lib/characters";
import { registerLabel } from "@/lib/native-alternative-shared";
import { cancelSpeech, speakChinese } from "@/lib/speech";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  CharacterSet,
  TranslateResponse,
  VoiceRegion,
} from "@mindyourlanguage/shared";

export type ResultLayout = "chinese-target" | "chinese-source";

interface ResultCardProps {
  result: TranslateResponse;
  characterSet: CharacterSet;
  layout?: ResultLayout;
  sourceText?: string;
  showPlayButtons?: boolean;
  voiceRegion?: VoiceRegion;
  isSaved?: boolean;
  onToggleSave?: () => void;
  phrasebookHint?: string;
}

function displayedChineseText(
  text: string,
  traditional: string | undefined,
  characterSet: CharacterSet,
): string {
  if (characterSet === "traditional" && traditional) {
    return traditional;
  }
  return text;
}

function displayedTranslation(
  result: TranslateResponse,
  characterSet: CharacterSet,
): string {
  return displayedChineseText(
    result.translation,
    result.traditional,
    characterSet,
  );
}

function PinyinBlock({ result }: { result: TranslateResponse }) {
  if (!result.pinyin) return null;

  return (
    <div className="flex flex-col gap-1 font-mono text-mono-sm text-muted-foreground">
      <p lang="zh-Latn">
        <span className="mr-2 font-medium text-foreground/70">
          Syllable pinyin
        </span>
        {result.pinyin}
      </p>
      {result.spokenPinyin ? (
        <p lang="zh-Latn" data-testid="spoken-pinyin">
          <span className="mr-2 font-medium text-foreground/70">
            Spoken pinyin
          </span>
          {result.spokenPinyin}
        </p>
      ) : null}
    </div>
  );
}

function SegmentList({
  segments,
}: {
  segments: TranslateResponse["segments"];
}) {
  if (segments.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Word segments">
      {segments.map((segment, index) => (
        <li
          key={`${segment.text}-${index}`}
          className="rounded-md bg-muted px-2 py-1 text-sm"
        >
          <span lang="zh" className="font-medium text-foreground">
            {segment.text}
          </span>
          {segment.pinyin ? (
            <span className="ml-1.5 font-mono text-mono-sm text-muted-foreground">
              {segment.pinyin}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

type RegisterTab = "translation" | "native";

const TAB_ID_TRANSLATION = "result-tab-translation";
const TAB_ID_NATIVE = "result-tab-native";
const PANEL_ID_TRANSLATION = "result-panel-translation";
const PANEL_ID_NATIVE = "result-panel-native";

/** Slow-playback speeds offered in the footer dropdown; 0.75 preserves the original default. */
const SPEECH_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5] as const;
const DEFAULT_SPEECH_RATE = 0.75;

/** Callers should pass `key={result.id}` so the register tab resets per result. */
export function ResultCard({
  result,
  characterSet,
  layout = "chinese-target",
  sourceText = "",
  showPlayButtons = false,
  voiceRegion = "zh-CN",
  isSaved = false,
  onToggleSave,
  phrasebookHint,
}: ResultCardProps) {
  const isChineseSource = layout === "chinese-source";
  const displayText = isChineseSource
    ? result.translation
    : displayedTranslation(result, characterSet);
  const chineseText = isChineseSource
    ? displayedChineseText(sourceText, result.traditional, characterSet)
    : displayText;
  const audioText = isChineseSource ? chineseText : displayText;

  const hasNative = Boolean(result.nativeAlternative && result.register);
  const [tab, setTab] = useState<RegisterTab>("translation");
  const [playbackRate, setPlaybackRate] = useState<number>(DEFAULT_SPEECH_RATE);
  const translationTabRef = useRef<HTMLButtonElement>(null);
  const nativeTabRef = useRef<HTMLButtonElement>(null);

  function handleTabListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      event.key !== "ArrowRight" &&
      event.key !== "ArrowLeft" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    if (event.key === "Home") {
      setTab("translation");
      translationTabRef.current?.focus();
      return;
    }
    if (event.key === "End") {
      setTab("native");
      nativeTabRef.current?.focus();
      return;
    }
    const next: RegisterTab = tab === "translation" ? "native" : "translation";
    setTab(next);
    (next === "translation" ? translationTabRef : nativeTabRef).current?.focus();
  }

  useEffect(() => {
    return () => cancelSpeech();
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(displayText);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  async function play(text: string, rate?: number) {
    try {
      const speechOpts = typeof rate === "number" ? { rate } : {};
      const { usedRegionFallback } = await speakChinese(text, voiceRegion, {
        ...speechOpts,
      });
      if (usedRegionFallback) {
        toast.info(
          voiceRegion === "zh-TW"
            ? "Taiwan voice unavailable — using the closest Chinese voice on this device."
            : "Mainland voice unavailable — using the closest Chinese voice on this device.",
        );
      }
    } catch {
      toast.error("Audio unavailable");
    }
  }

  const nativeText = result.nativeAlternative
    ? displayForCharacterSet(result.nativeAlternative, characterSet)
    : null;
  const playText = tab === "native" && nativeText ? nativeText : audioText;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        {hasNative ? (
          <div
            role="tablist"
            aria-label="Translation registers"
            className="flex w-fit gap-1 rounded-full bg-muted p-1"
            onKeyDown={handleTabListKeyDown}
          >
            <button
              ref={translationTabRef}
              type="button"
              role="tab"
              id={TAB_ID_TRANSLATION}
              aria-selected={tab === "translation"}
              aria-controls={PANEL_ID_TRANSLATION}
              tabIndex={tab === "translation" ? 0 : -1}
              onClick={() => setTab("translation")}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                tab === "translation"
                  ? "bg-card font-medium text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Translation · 中性
            </button>
            <button
              ref={nativeTabRef}
              type="button"
              role="tab"
              id={TAB_ID_NATIVE}
              aria-selected={tab === "native"}
              aria-controls={PANEL_ID_NATIVE}
              tabIndex={tab === "native" ? 0 : -1}
              onClick={() => setTab("native")}
              data-testid="native-register-tab"
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                tab === "native"
                  ? "bg-card font-medium text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Native alternative ·{" "}
              {registerLabel(result.register ?? "neutral")}
            </button>
          </div>
        ) : (
          <CardTitle>Translation</CardTitle>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Both panels stay mounted so state (and static markup) survives tab switches. */}
        {hasNative && nativeText ? (
          <div
            role="tabpanel"
            id={PANEL_ID_NATIVE}
            aria-labelledby={TAB_ID_NATIVE}
            data-testid="native-panel"
            className={tab === "native" ? "flex flex-col gap-3" : "hidden"}
          >
            <p
              lang="zh"
              className="break-anywhere text-reading-lg text-foreground"
            >
              {nativeText}
            </p>
            {result.nativeNote ? (
              <p className="text-sm text-muted-foreground">
                {result.nativeNote}
              </p>
            ) : null}
          </div>
        ) : null}
        <div
          role="tabpanel"
          id={PANEL_ID_TRANSLATION}
          aria-labelledby={hasNative ? TAB_ID_TRANSLATION : undefined}
          className={
            tab === "native" && hasNative && nativeText
              ? "hidden"
              : "flex flex-col gap-4"
          }
        >
          <p
            data-testid="result-translation"
            lang={isChineseSource ? undefined : "zh"}
            className="break-anywhere text-reading-lg text-foreground"
          >
            {displayText}
          </p>

          {isChineseSource ? (
            <div
              className="flex flex-col gap-3 border-t border-border pt-4"
              data-testid="source-chinese-block"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Mandarin source
              </p>
              <p
                data-testid="source-chinese-text"
                lang="zh"
                className="break-anywhere text-reading-lg text-foreground"
              >
                {chineseText}
              </p>
              <PinyinBlock result={result} />
              <SegmentList segments={result.segments} />
            </div>
          ) : (
            <>
              <PinyinBlock result={result} />
              <SegmentList segments={result.segments} />
            </>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 max-sm:grid max-sm:grid-cols-2">
        {showPlayButtons ? (
          <>
            <Button
              type="button"
              className="touch-target-sm max-sm:text-sm"
              onClick={() => play(playText)}
            >
              <Play />
              Play
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="touch-target-sm max-sm:text-sm"
                  aria-label="Playback speed"
                  data-testid="playback-speed-trigger"
                >
                  {playbackRate}×
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {SPEECH_RATES.map((rate) => (
                  <DropdownMenuItem
                    key={rate}
                    aria-label={`Play at ${rate} speed`}
                    data-testid={`playback-speed-${rate}`}
                    onSelect={() => {
                      setPlaybackRate(rate);
                      void play(playText, rate);
                    }}
                  >
                    <Check
                      className={
                        rate === playbackRate ? "opacity-100" : "opacity-0"
                      }
                    />
                    {rate}×
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
        {onToggleSave ? (
          <Button
            type="button"
            variant={isSaved ? "secondary" : "outline"}
            className="touch-target-sm max-sm:text-sm"
            onClick={onToggleSave}
          >
            <Bookmark />
            {isSaved ? "Saved" : "Save to phrasebook"}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="touch-target-sm max-sm:text-sm"
          onClick={handleCopy}
        >
          <Copy />
          Copy
        </Button>
        {phrasebookHint ? (
          <p className="basis-full text-sm text-muted-foreground">
            {phrasebookHint}
          </p>
        ) : null}
      </CardFooter>
    </Card>
  );
}
