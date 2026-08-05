"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ShadowingPlayer } from "@/components/shadowing-player";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  CheckAttemptResponse,
  TranslateResponse,
  TranslationSegment,
  VoiceRegion,
} from "@mindyourlanguage/shared";

interface ComparisonPanelProps {
  sourceText: string;
  userAttempt: string;
  result: TranslateResponse;
  voiceRegion: VoiceRegion;
}

export function ComparisonPanel({
  sourceText,
  userAttempt,
  result,
  voiceRegion,
}: ComparisonPanelProps) {
  const attempt = userAttempt.trim();
  const [checkAvailable, setCheckAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [feedback, setFeedback] = useState<CheckAttemptResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadAvailability() {
      try {
        const response = await fetch("/api/practice/check");
        if (!response.ok) return;
        const data = (await response.json()) as { available?: boolean };
        if (!cancelled) setCheckAvailable(Boolean(data.available));
      } catch {
        if (!cancelled) setCheckAvailable(false);
      }
    }
    void loadAvailability();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!attempt) return null;

  async function handleCheck() {
    setIsChecking(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/practice/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText,
          userAttempt: attempt,
          primaryTranslation: result.translation,
          nativeAlternative: result.nativeAlternative,
        }),
      });

      if (response.status === 503) {
        setCheckAvailable(false);
        toast.error("Check attempt unavailable");
        return;
      }

      if (!response.ok) {
        toast.error("Could not check attempt");
        return;
      }

      const data = (await response.json()) as CheckAttemptResponse;
      setFeedback(data);
    } catch {
      toast.error("Could not check attempt");
    } finally {
      setIsChecking(false);
    }
  }

  const segments: TranslationSegment[] =
    result.segments.length > 0
      ? result.segments
      : [{ text: result.translation, pinyin: result.pinyin ?? "" }];

  return (
    <Card data-testid="comparison-panel">
      <CardHeader>
        <CardTitle>Compare your attempt</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <ComparisonColumn label="Your attempt" text={attempt} />
        <ComparisonColumn label="Translation" text={result.translation} />
        <ComparisonColumn
          label="Native alternative"
          text={result.nativeAlternative ?? "—"}
        />
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-3">
        <ShadowingPlayer
          text={result.translation}
          segments={segments}
          region={voiceRegion}
        />
        {checkAvailable ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCheck}
            disabled={isChecking}
            data-testid="check-attempt"
          >
            {isChecking ? (
              <>
                <Loader2 className="animate-spin" />
                Checking…
              </>
            ) : (
              "Check my attempt"
            )}
          </Button>
        ) : null}
        {feedback ? (
          <div
            className="w-full rounded-lg border border-border bg-muted/40 p-3 text-sm"
            data-testid="check-feedback"
          >
            <p className="font-medium capitalize text-foreground">
              {feedback.verdict}
            </p>
            <p className="mt-1 text-muted-foreground">{feedback.feedback}</p>
            {feedback.betterPhrasing ? (
              <p className="mt-2 text-foreground">
                Better phrasing: {feedback.betterPhrasing}
              </p>
            ) : null}
            {feedback.corrections && feedback.corrections.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                {feedback.corrections.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardFooter>
    </Card>
  );
}

function ComparisonColumn({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-base leading-relaxed text-foreground">{text}</p>
    </div>
  );
}
