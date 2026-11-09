"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useHistoryStore } from "@/lib/stores/history";
import { usePhrasebookStore } from "@/lib/stores/phrasebook";
import { useReviewEventsStore } from "@/lib/stores/review-events";
import { pullAllStores, type PullResult } from "@/lib/sync/cloud-sync";

export type SyncPhraseAction = "save" | "open" | "forget";

type ShownRows = {
  phrasebook: readonly unknown[];
  history: readonly unknown[];
  events: readonly unknown[];
};

/** Save sends the rows on screen so a device-only phrasebook can be opened elsewhere. */
export function bodyForSyncAction(
  action: SyncPhraseAction,
  phrase: string,
  shown: ShownRows,
) {
  if (action === "forget") return { action };
  if (action === "open") return { action, phrase };
  return {
    action,
    phrase,
    phrasebook: shown.phrasebook,
    history: shown.history,
    events: shown.events,
  };
}

export function messageAfterOpen(result: PullResult, phraseCount: number): string {
  if (result !== "ok") {
    return "The phrase was accepted, but the phrasebook did not load. Reload and try Open phrase again.";
  }
  if (phraseCount === 0) {
    return "Opened the phrase, but it has no saved phrases yet. Save it in the browser that shows your phrases, then choose Open phrase here again.";
  }
  return "Opened your phrasebook on this browser.";
}

/** Open and forget reload this browser. A failed request must not pull. */
export function followupAfterSyncAction(
  action: SyncPhraseAction,
  ok: boolean,
): "pull" | "none" {
  if (!ok) return "none";
  if (action === "open" || action === "forget") return "pull";
  return "none";
}

/**
 * One remembered phrase opens the same Neon phrasebook in every browser.
 * Save it where the phrases already show, then open it everywhere else.
 */
export function SyncPhraseForm({ hasPhrases }: { hasPhrases: boolean }) {
  const [phrase, setPhrase] = useState("");
  const [linked, setLinked] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState<SyncPhraseAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/sync-phrase");
        if (cancelled) return;
        if (response.status === 501) {
          setHidden(true);
          return;
        }
        if (!response.ok) return;
        const data = (await response.json()) as { linked?: boolean };
        setLinked(Boolean(data.linked));
      } catch {
        // The form stays available so a later save or open can retry.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (hidden) return null;

  async function submit(action: SyncPhraseAction) {
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch("/api/sync-phrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          bodyForSyncAction(action, phrase, {
            phrasebook: usePhrasebookStore.getState().items,
            history: useHistoryStore.getState().items,
            events: useReviewEventsStore.getState().events,
          }),
        ),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        replaced?: boolean;
      };
      if (!response.ok) {
        setMessage(data.error ?? "Could not use that sync phrase.");
        return;
      }

      if (followupAfterSyncAction(action, true) === "pull") {
        const result = await pullAllStores();
        if (action === "forget") {
          setLinked(false);
          setMessage(
            result === "ok"
              ? "This browser is back to its own saved phrases."
              : "Stopped using the sync phrase, but the list did not reload. Reload the page.",
          );
          return;
        }
        setLinked(true);
        setMessage(
          messageAfterOpen(result, usePhrasebookStore.getState().items.length),
        );
        return;
      }

      setLinked(true);
      setMessage(
        data.replaced
          ? "Saved the new phrase. Other browsers still using the previous one must type this phrase and choose Open phrase."
          : "Saved. In each other browser, type this same phrase and choose Open phrase.",
      );
    } catch {
      setMessage("Could not reach the server. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const canSave = hasPhrases || linked;

  return (
    <form
      className="flex flex-col gap-2 px-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(canSave ? "save" : "open");
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Sync phrase</span>
        <input
          type="text"
          value={phrase}
          onChange={(event) => setPhrase(event.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          disabled={busy !== null}
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        {linked
          ? "This browser uses your sync phrase. Type it in Safari, Brave, or Chrome and choose Open phrase."
          : "Save the phrase in the browser that already shows your phrases. Then type it in any other browser and choose Open phrase. Pick a phrase other people would not guess."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={canSave ? "default" : "outline"}
          disabled={busy !== null || !canSave}
          onClick={() => void submit("save")}
        >
          {busy === "save" ? "Saving…" : "Save phrase"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={canSave ? "outline" : "default"}
          disabled={busy !== null}
          onClick={() => void submit("open")}
        >
          {busy === "open" ? "Opening…" : "Open phrase"}
        </Button>
      </div>
      {linked ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy !== null}
          onClick={() => void submit("forget")}
        >
          Use this browser only
        </Button>
      ) : null}
      {message ? (
        <p className="text-sm text-foreground" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
