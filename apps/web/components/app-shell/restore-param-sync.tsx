"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export type RestoreResult = "restored" | "pending" | "missing";

interface RestoreParamSyncProps {
  onRestore: (id: string) => RestoreResult;
}

/**
 * Consumes `?restore=<id>` from the URL and delegates restoration to `onRestore`.
 *
 * `onRestore` returns `"restored" | "pending" | "missing"`.
 * - `"restored"`: target applied; strip `?restore=` via `router.replace("/")`.
 * - `"missing"`: id not found; strip the param.
 * - `"pending"`: stores not hydrated yet — keep the `?restore=` param and retry.
 *   The retry happens when this effect re-runs because `onRestore`'s identity changes
 *   (it is listed in the effect dependency array).
 *
 * CONTRACT FOR CONSUMERS: pass a plain closure over the current store items (its
 * identity changes when items change, e.g. after persist hydration finishes). Do NOT
 * wrap it in `useCallback` with stale or empty deps, or pending restores will never be
 * retried.
 *
 * `onRestore` must be idempotent: a retry can invoke it more than once for the same
 * id before the param strip settles.
 */
export function RestoreParamSync({ onRestore }: RestoreParamSyncProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const param = searchParams.get("restore");

  useEffect(() => {
    if (!param) return;
    const result = onRestore(param);
    if (result === "restored" || result === "missing") {
      router.replace("/", { scroll: false });
    }
  }, [param, onRestore, router]);

  return null;
}