"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

interface DrawerParamSyncProps {
  onOpenDrawer: (drawer: string) => void;
}

/** Turns `/?drawer=phrasebook|history` into an opened drawer, then strips the param. */
export function DrawerParamSync({ onOpenDrawer }: DrawerParamSyncProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const param = searchParams.get("drawer");

  useEffect(() => {
    if (param === "phrasebook" || param === "history") {
      onOpenDrawer(param);
      router.replace("/", { scroll: false });
    }
  }, [param, onOpenDrawer, router]);

  return null;
}
