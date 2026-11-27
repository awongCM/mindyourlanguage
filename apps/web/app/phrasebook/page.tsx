"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsDesktop } from "@/components/app-shell/use-is-desktop";
import { SavedListsScreen } from "@/components/lists/saved-lists-screen";

export default function PhrasebookPage() {
  const router = useRouter();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (isDesktop) {
      router.replace("/?drawer=phrasebook");
    }
  }, [isDesktop, router]);

  if (isDesktop) return null;

  return (
    <div className="lg:hidden">
      <SavedListsScreen view="phrasebook" />
    </div>
  );
}