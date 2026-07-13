"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
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
  TranslateResponse,
} from "@mindyourlanguage/shared";

interface ResultCardProps {
  result: TranslateResponse;
  characterSet: CharacterSet;
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

export function ResultCard({ result, characterSet }: ResultCardProps) {
  const displayText = displayedTranslation(result, characterSet);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(displayText);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  function handlePlayStub(region: "Mainland" | "Taiwan") {
    toast.info(`Play ${region} — coming soon`);
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
          disabled
          onClick={() => handlePlayStub("Mainland")}
          title="Coming soon"
        >
          Play Mainland
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          onClick={() => handlePlayStub("Taiwan")}
          title="Coming soon"
        >
          Play Taiwan
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          <Copy />
          Copy
        </Button>
      </CardFooter>
    </Card>
  );
}
