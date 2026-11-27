"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CharacterSet, VoiceRegion } from "@mindyourlanguage/shared";

interface TogglesProps {
  characterSet: CharacterSet;
  onCharacterSetChange: (v: CharacterSet) => void;
  voiceRegion: VoiceRegion;
  onVoiceRegionChange: (v: VoiceRegion) => void;
}

const GROUP_CLASS = "rounded-full bg-muted p-1";
const ITEM_CLASS =
  "rounded-full px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

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
        className={GROUP_CLASS}
      >
        <ToggleGroupItem value="simplified" className={ITEM_CLASS}>
          简体
        </ToggleGroupItem>
        <ToggleGroupItem value="traditional" className={ITEM_CLASS}>
          繁體
        </ToggleGroupItem>
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
        className={GROUP_CLASS}
      >
        <ToggleGroupItem value="zh-CN" className={ITEM_CLASS}>
          CN Voice
        </ToggleGroupItem>
        <ToggleGroupItem value="zh-TW" className={ITEM_CLASS}>
          TW Voice
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}