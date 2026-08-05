"use client";

import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";

const STORAGE_KEY = "myl-try-first";

function readTryFirstEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

interface TryFirstPanelProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  attempt: string;
  onAttemptChange: (attempt: string) => void;
  disabled?: boolean;
}

export function TryFirstPanel({
  enabled,
  onEnabledChange,
  attempt,
  onAttemptChange,
  disabled = false,
}: TryFirstPanelProps) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    onEnabledChange(readTryFirstEnabled());
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once from localStorage
  }, []);

  function handleEnabledChange(next: boolean) {
    onEnabledChange(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore quota / private mode
    }
  }

  if (!hydrated) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3" data-testid="try-first-panel">
      <label className="flex w-fit items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => handleEnabledChange(event.target.checked)}
          disabled={disabled}
          className="size-4 rounded border-foreground/20"
          data-testid="try-first-toggle"
        />
        Try first
      </label>

      {enabled ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="user-attempt"
            className="text-sm font-medium text-foreground"
          >
            Your Mandarin attempt (optional)
          </label>
          <Textarea
            id="user-attempt"
            value={attempt}
            onChange={(event) => onAttemptChange(event.target.value)}
            placeholder="Write your Mandarin before revealing the translation…"
            rows={3}
            disabled={disabled}
            data-testid="user-attempt"
          />
        </div>
      ) : null}
    </div>
  );
}
