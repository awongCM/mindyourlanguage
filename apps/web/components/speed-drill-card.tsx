"use client";

import { ShadowingPlayer } from "@/components/shadowing-player";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { fluencyStatusText } from "@/lib/practice/fluency";
import type { PhrasebookEntry, VoiceRegion } from "@mindyourlanguage/shared";
import {
  useSpeedDrillSession,
  type SpeedDrillPhase,
} from "@/components/use-speed-drill-session";

interface SpeedDrillCardProps {
  entry: PhrasebookEntry;
  onSessionComplete: () => void;
  onNext: () => void;
  voiceRegion: VoiceRegion;
}

const MISS_MESSAGE: Record<Extract<SpeedDrillPhase, "timeout" | "mismatch">, string> = {
  timeout: "The clock hit zero. Hear the phrase, then start the three passes again.",
  mismatch:
    "That doesn't match the saved wording yet. Hear it, then start the three passes again.",
};

export function SpeedDrillCard({
  entry,
  onSessionComplete,
  onNext,
  voiceRegion,
}: SpeedDrillCardProps) {
  const session = useSpeedDrillSession(entry, onSessionComplete);
  const progress = fluencyStatusText(entry.practiceStats);
  const showFooter =
    session.phase === "timeout" ||
    session.phase === "mismatch" ||
    session.phase === "done";

  return (
    <Card data-testid="speed-drill-card">
      <CardHeader>
        <CardTitle>Speed</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p
          className="break-anywhere text-lg leading-relaxed text-foreground"
          data-testid="drill-prompt"
        >
          {entry.sourceText}
        </p>
        <p className="text-sm text-muted-foreground" data-testid="speed-status">
          {progress}
        </p>

        {session.phase === "running" ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              session.submitAttempt();
            }}
          >
            <p className="text-sm text-muted-foreground" data-testid="speed-pass">
              Pass {session.passIndex + 1} of {session.passCount} ·{" "}
              {session.passLimitSeconds} seconds
            </p>
            <p
              className="text-3xl font-semibold tabular-nums text-foreground"
              data-testid="speed-remaining"
            >
              {session.secondsLeft}
            </p>
            <label className="flex flex-col gap-2 text-sm text-muted-foreground">
              Say it aloud, then type the saved Mandarin.
              <Textarea
                id="speed-attempt"
                value={session.attempt}
                onChange={(event) => session.setAttempt(event.target.value)}
                data-testid="speed-attempt"
                lang="zh"
                autoFocus
              />
            </label>
            <Button type="submit" className="touch-target-sm" data-testid="speed-check">
              Check
            </Button>
          </form>
        ) : null}

        {session.phase === "timeout" || session.phase === "mismatch" ? (
          <div className="flex flex-col gap-3" data-testid="speed-miss">
            <p className="text-sm text-muted-foreground">
              {MISS_MESSAGE[session.phase]}
            </p>
            <p className="break-anywhere text-xl font-medium text-foreground">
              {entry.translation}
            </p>
            {entry.pinyin ? (
              <p className="text-sm text-muted-foreground" lang="zh-Latn">
                {entry.pinyin}
              </p>
            ) : null}
            <ShadowingPlayer
              text={entry.translation}
              segments={entry.segments}
              region={voiceRegion}
            />
          </div>
        ) : null}

        {session.phase === "done" ? (
          <div className="flex flex-col gap-2" data-testid="speed-done">
            <p className="text-sm text-foreground">Fast day saved.</p>
            <p className="text-sm text-muted-foreground">{progress}</p>
          </div>
        ) : null}
      </CardContent>

      {showFooter ? (
        <CardFooter>
          {session.phase === "done" ? (
            <Button
              type="button"
              className="touch-target-sm"
              onClick={onNext}
              data-testid="speed-next"
            >
              Next phrase
            </Button>
          ) : (
            <Button
              type="button"
              className="touch-target-sm"
              onClick={session.restartSession}
              data-testid="speed-try-again"
            >
              Start again
            </Button>
          )}
        </CardFooter>
      ) : null}
    </Card>
  );
}
