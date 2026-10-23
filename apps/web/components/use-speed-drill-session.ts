"use client";

import { useEffect, useRef, useState } from "react";
import {
  SPEED_LIMITS_MS,
  evaluateSpeedAttempt,
} from "@/lib/practice/fluency";
import type { PhrasebookEntry } from "@mindyourlanguage/shared";

export type SpeedDrillPhase = "running" | "timeout" | "mismatch" | "done";

export function useSpeedDrillSession(
  entry: PhrasebookEntry,
  onSessionComplete: () => void,
) {
  const [passIndex, setPassIndex] = useState(0);
  const [phase, setPhase] = useState<SpeedDrillPhase>("running");
  const [attempt, setAttempt] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(SPEED_LIMITS_MS[0] / 1000);
  const deadlineMsRef = useRef(0);
  const passLimitMsRef = useRef<number>(SPEED_LIMITS_MS[0]);

  function startPass(index: number) {
    const limitMs = SPEED_LIMITS_MS[index];
    passLimitMsRef.current = limitMs;
    deadlineMsRef.current = Date.now() + limitMs;
    setPassIndex(index);
    setSecondsLeft(limitMs / 1000);
    setAttempt("");
    setPhase("running");
  }

  useEffect(() => {
    if (phase !== "running") return;
    if (deadlineMsRef.current === 0) {
      deadlineMsRef.current = Date.now() + passLimitMsRef.current;
    }

    const tick = () => {
      const msRemaining = deadlineMsRef.current - Date.now();
      const nextSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
      setSecondsLeft((current) => (current === nextSeconds ? current : nextSeconds));
      if (msRemaining <= 0) setPhase("timeout");
    };

    tick();
    const intervalId = window.setInterval(tick, 200);
    return () => window.clearInterval(intervalId);
  }, [phase, passIndex]);

  function submitAttempt() {
    if (phase !== "running") return;

    const elapsedMs = Math.max(
      0,
      passLimitMsRef.current - (deadlineMsRef.current - Date.now()),
    );
    const outcome = evaluateSpeedAttempt({
      attempt,
      translation: entry.translation,
      traditional: entry.traditional,
      elapsedMs,
      limitMs: passLimitMsRef.current,
    });

    if (outcome === "pass") {
      const isLastPass = passIndex >= SPEED_LIMITS_MS.length - 1;
      if (isLastPass) {
        setPhase("done");
        onSessionComplete();
        return;
      }
      startPass(passIndex + 1);
      return;
    }

    setPhase(outcome);
  }

  const passLimitSeconds = SPEED_LIMITS_MS[passIndex] / 1000;

  return {
    passIndex,
    passCount: SPEED_LIMITS_MS.length,
    passLimitSeconds,
    phase,
    attempt,
    setAttempt,
    secondsLeft,
    submitAttempt,
    restartSession: () => startPass(0),
  };
}
