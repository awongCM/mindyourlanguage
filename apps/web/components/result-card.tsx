"use client";

import { useEffect } from "react";
import { Bookmark, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

interface ResultCardProps {
  result: TranslateResponse;
  characterSet: CharacterSet;
  isSaved?: boolean;
  onToggleSave?: () => void;
}

function displayedTranslation(
  result: TranslateResponse,
  characterSet: CharacterSet,
): string {
  if (characterSet === "traditional" && result.traditional) {
    return result.traditional;
  }
  return result.translation;
}

export function ResultCard({
  result,
  characterSet,
  isSaved = false,
  onToggleSave,
}: ResultCardProps) {
  const displayText = displayedTranslation(result, characterSet);

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
      await speakChinese(displayText, region);
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

        {result.pinyin ? (
          <p className="text-sm text-muted-foreground" lang="zh-Latn">
            {result.pinyin}
          </p>
        ) : null}

        {result.segments.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Word segments">
            {result.segments.map((segment, index) => (
              <li
                key={`${segment.text}-${index}`}
                className="rounded-md bg-muted px-2 py-1 text-sm"
              >
                <span className="font-medium text-foreground">
                  {segment.text}
                </span>
                {segment.pinyin ? (
                  <span className="ml-1.5 text-muted-foreground">
                    {segment.pinyin}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
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
