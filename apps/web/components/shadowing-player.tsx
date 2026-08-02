"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  cancelSpeech,
  speakChinese,
  speakChineseSlow,
  speakSegments,
} from "@/lib/speech";
import type { TranslationSegment, VoiceRegion } from "@mindyourlanguage/shared";

interface ShadowingPlayerProps {
  text: string;
  segments?: TranslationSegment[];
  region: VoiceRegion;
}

export function ShadowingPlayer({
  text,
  segments = [],
  region,
}: ShadowingPlayerProps) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => cancelSpeech();
  }, []);

  function handleStop() {
    cancelSpeech();
    setBusy(false);
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
    } catch {
      toast.error("Audio unavailable");
    } finally {
      setBusy(false);
    }
  }

  const segmentTexts = segments.map((segment) => segment.text);

  return (
    <div
      className="flex flex-wrap gap-2"
      data-testid="shadowing-player"
      aria-label="Shadowing controls"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || !text.trim()}
        onClick={() => run(() => speakChinese(text, region))}
      >
        Play full
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || !text.trim()}
        onClick={() =>
          run(() => speakChineseSlow(text, region, segmentTexts))
        }
      >
        Play slow
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || !segmentTexts.some((part) => part.trim())}
        onClick={() =>
          run(() =>
            speakSegments(segmentTexts, region),
          )
        }
      >
        Play segments
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleStop}
        data-testid="stop-audio"
      >
        Stop
      </Button>
    </div>
  );
}
