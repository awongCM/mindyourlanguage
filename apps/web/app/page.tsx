"use client";

import { useState } from "react";
import { Toggles } from "@/components/toggles";
import type { CharacterSet, VoiceRegion } from "@mindyourlanguage/shared";

export default function Home() {
  const [characterSet, setCharacterSet] =
    useState<CharacterSet>("simplified");
  const [voiceRegion, setVoiceRegion] = useState<VoiceRegion>("zh-CN");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Mind Your Language
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          From solid intermediate to natural fluency.
        </p>
      </div>

      <Toggles
        characterSet={characterSet}
        onCharacterSetChange={setCharacterSet}
        voiceRegion={voiceRegion}
        onVoiceRegionChange={setVoiceRegion}
      />
    </main>
  );
}
