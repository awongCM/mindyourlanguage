"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export type RestoreResult = "restored" | "pending" | "missing";

interface RestoreParamSyncProps {
  onRestore: (id: string) => RestoreResult;
}

/** Consumes `?restore=<id>`; keeps the param while stores report "pending". */
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