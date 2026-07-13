"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CharacterSet, VoiceRegion } from "@mindyourlanguage/shared";

interface TogglesProps {
  characterSet: CharacterSet;
  onCharacterSetChange: (v: CharacterSet) => void;
  voiceRegion: VoiceRegion;
  onVoiceRegionChange: (v: VoiceRegion) => void;
}

export function Toggles({
  characterSet,
  onCharacterSetChange,
  voiceRegion,
  onVoiceRegionChange,
}: TogglesProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={characterSet}
        onValueChange={(value) => {
          if (value === "simplified" || value === "traditional") {
            onCharacterSetChange(value);
          }
        }}
        aria-label="Character set"
      >
        <ToggleGroupItem value="simplified">简体</ToggleGroupItem>
        <ToggleGroupItem value="traditional">繁體</ToggleGroupItem>
      </ToggleGroup>

      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={voiceRegion}
        onValueChange={(value) => {
          if (value === "zh-CN" || value === "zh-TW") {
            onVoiceRegionChange(value);
          }
        }}
        aria-label="Voice region"
      >
        <ToggleGroupItem value="zh-CN">CN Voice</ToggleGroupItem>
        <ToggleGroupItem value="zh-TW">TW Voice</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
