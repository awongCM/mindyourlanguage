"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  SPEED_LIMITS_MS,
  evaluateSpeedAttempt,
  fluencyStatusText,
} from "@/lib/practice/fluency";
import type { PhrasebookEntry, VoiceRegion } from "@mindyourlanguage/shared";

interface SpeedDrillCardProps {
  entry: PhrasebookEntry;
  onSessionComplete: () => void;
  onNext: () => void;
  voiceRegion: VoiceRegion;
}

type Phase = "running" | "timeout" | "mismatch" | "done";

const MISS_COPY: Record<"timeout" | "mismatch", string> = {
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
  const [passIndex, setPassIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("running");
  const [attempt, setAttempt] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(SPEED_LIMITS_MS[0] / 1000);
  const deadlineRef = useRef(0);
  const limitRef = useRef<number>(SPEED_LIMITS_MS[0]);

  function beginPass(index: number) {
    const limit = SPEED_LIMITS_MS[index];
    limitRef.current = limit;
    deadlineRef.current = Date.now() + limit;
    setPassIndex(index);
    setSecondsLeft(limit / 1000);
    setAttempt("");
    setPhase("running");
  }

  useEffect(() => {
    if (phase !== "running") return;
    if (deadlineRef.current === 0) {
      deadlineRef.current = Date.now() + limitRef.current;
    }

    const tick = () => {
      const left = deadlineRef.current - Date.now();
      const seconds = Math.max(0, Math.ceil(left / 1000));
      setSecondsLeft((current) => (current === seconds ? current : seconds));
      if (left <= 0) setPhase("timeout");
    };

    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [phase, passIndex]);

  function handleCheck() {
    if (phase !== "running") return;
    const elapsed = limitRef.current - (deadlineRef.current - Date.now());
    const result = evaluateSpeedAttempt({
      attempt,
      translation: entry.translation,
      traditional: entry.traditional,
      elapsedMs: Math.max(0, elapsed),
      limitMs: limitRef.current,
    });

    if (result === "pass") {
      if (passIndex >= SPEED_LIMITS_MS.length - 1) {
        setPhase("done");
        onSessionComplete();
        return;
      }
      beginPass(passIndex + 1);
      return;
    }

    setPhase(result);
  }

  const limitSeconds = SPEED_LIMITS_MS[passIndex] / 1000;
  const status = fluencyStatusText(entry.practiceStats);

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
          {status}
        </p>
        {phase === "running" ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              handleCheck();
            }}
          >
            <p className="text-sm text-muted-foreground" data-testid="speed-pass">
              Pass {passIndex + 1} of {SPEED_LIMITS_MS.length} · {limitSeconds}{" "}
              seconds
            </p>
            <p
              className="text-3xl font-semibold tabular-nums text-foreground"
              data-testid="speed-remaining"
            >
              {secondsLeft}
            </p>
            <label className="flex flex-col gap-2 text-sm text-muted-foreground">
              Say it aloud, then type the saved Mandarin.
              <Textarea
                id="speed-attempt"
                value={attempt}
                onChange={(event) => setAttempt(event.target.value)}
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
        {phase === "timeout" || phase === "mismatch" ? (
          <div className="flex flex-col gap-3" data-testid="speed-miss">
            <p className="text-sm text-muted-foreground">{MISS_COPY[phase]}</p>
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
        {phase === "done" ? (
          <div className="flex flex-col gap-2" data-testid="speed-done">
            <p className="text-sm text-foreground">Fast day saved.</p>
            <p className="text-sm text-muted-foreground">{status}</p>
          </div>
        ) : null}
      </CardContent>
      {phase === "timeout" || phase === "mismatch" || phase === "done" ? (
        <CardFooter>
          {phase === "done" ? (
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
              onClick={() => beginPass(0)}
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
