"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { pullAllStores } from "@/lib/sync/cloud-sync";

/**
 * One remembered phrase opens the same Neon phrasebook in every browser.
 * Save it where the phrases already show, then open it everywhere else.
 */
export function SyncPhraseForm({ hasPhrases }: { hasPhrases: boolean }) {
  const [phrase, setPhrase] = useState("");
  const [linked, setLinked] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState<"save" | "open" | null>(null);
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

  async function submit(action: "save" | "open") {
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch("/api/sync-phrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase, action }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setMessage(data.error ?? "Could not use that sync phrase.");
        return;
      }

      setLinked(true);
      if (action === "open") {
        const result = await pullAllStores();
        setMessage(
          result === "ok"
            ? "Opened your phrasebook on this browser."
            : "The phrase was accepted, but the phrasebook did not load. Reload and try Open phrase again.",
        );
        return;
      }

      setMessage(
        "Saved. In each other browser, type this same phrase and choose Open phrase.",
      );
    } catch {
      setMessage("Could not reach the server. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const savePrimary = hasPhrases || linked;

  return (
    <form
      className="flex flex-col gap-2 px-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(savePrimary ? "save" : "open");
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
          variant={savePrimary ? "default" : "outline"}
          disabled={busy !== null}
          onClick={() => void submit("save")}
        >
          {busy === "save" ? "Saving…" : "Save phrase"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={savePrimary ? "outline" : "default"}
          disabled={busy !== null}
          onClick={() => void submit("open")}
        >
          {busy === "open" ? "Opening…" : "Open phrase"}
        </Button>
      </div>
      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
