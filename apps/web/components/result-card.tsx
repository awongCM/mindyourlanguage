"use client";

import { useEffect } from "react";
import { Bookmark, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ShadowingPlayer } from "@/components/shadowing-player";
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
    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
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

function SegmentList({ segments }: { segments: TranslateResponse["segments"] }) {
  if (segments.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Word segments">
      {segments.map((segment, index) => (
        <li
          key={`${segment.text}-${index}`}
          className="rounded-md bg-muted px-2 py-1 text-sm"
        >
          <span className="font-medium text-foreground">{segment.text}</span>
          {segment.pinyin ? (
            <span className="ml-1.5 text-muted-foreground">
              {segment.pinyin}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function ResultCard({
  result,
  characterSet,
  layout = "chinese-target",
  sourceText = "",
  showPlayButtons = false,
  voiceRegion = "zh-CN",
  isSaved = false,
  onToggleSave,
}: ResultCardProps) {
  const isChineseSource = layout === "chinese-source";
  const displayText = isChineseSource
    ? result.translation
    : displayedTranslation(result, characterSet);
  const chineseText = isChineseSource
    ? displayedChineseText(sourceText, result.traditional, characterSet)
    : displayText;
  const audioText = isChineseSource ? chineseText : displayText;

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

  async function handlePlay(region: VoiceRegion) {
    try {
      const { usedRegionFallback } = await speakChinese(audioText, region);
      if (usedRegionFallback) {
        toast.info(
          region === "zh-TW"
            ? "Taiwan voice unavailable — using the closest Chinese voice on this device."
            : "Mainland voice unavailable — using the closest Chinese voice on this device.",
        );
      }
    } catch {
      toast.error("Audio unavailable");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Translation</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p
          data-testid="result-translation"
          className="text-lg leading-relaxed text-foreground"
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
              className="text-lg leading-relaxed text-foreground"
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

        {showPlayButtons ? (
          <ShadowingPlayer
            text={audioText}
            segments={result.segments}
            region={voiceRegion}
          />
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {showPlayButtons ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handlePlay("zh-CN")}
            >
              Play Mainland
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handlePlay("zh-TW")}
            >
              Play Taiwan
            </Button>
          </>
        ) : null}
        {onToggleSave ? (
          <Button
            type="button"
            variant={isSaved ? "secondary" : "outline"}
            size="sm"
            onClick={onToggleSave}
          >
            <Bookmark />
            {isSaved ? "Saved" : "Save to phrasebook"}
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          <Copy />
          Copy
        </Button>
      </CardFooter>
    </Card>
  );
}
