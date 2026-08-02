"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  cancelSpeech,
  speakChinese,
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

  const hasSegments = segments.some((segment) => segment.text.trim());

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
        onClick={() => run(() => speakChinese(text, region, { rate: 0.75 }))}
      >
        Play slow
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || !hasSegments}
        onClick={() =>
          run(() =>
            speakSegments(
              segments.map((segment) => segment.text),
              region,
            ),
          )
        }
      >
        Play segments
      </Button>
    </div>
  );
}
