"use client";

import { Toggles } from "@/components/toggles";
import {
  TranslatorForm,
  type TranslateDirection,
} from "@/components/translator-form";
import { Card, CardContent } from "@/components/ui/card";
import type { CharacterSet, VoiceRegion } from "@mindyourlanguage/shared";

interface ComposerCardProps {
  characterSet: CharacterSet;
  onCharacterSetChange: (value: CharacterSet) => void;
  voiceRegion: VoiceRegion;
  onVoiceRegionChange: (value: VoiceRegion) => void;
  sourceText: string;
  onSourceTextChange: (text: string) => void;
  onSubmit: (text: string) => void;
  onClear: () => void;
  isLoading: boolean;
  direction: TranslateDirection;
  onDirectionChange: (direction: TranslateDirection) => void;
  showNativeAlternative: boolean;
  includeNativeAlternative: boolean;
  onIncludeNativeAlternativeChange: (value: boolean) => void;
}

export function ComposerCard({
  characterSet,
  onCharacterSetChange,
  voiceRegion,
  onVoiceRegionChange,
  sourceText,
  onSourceTextChange,
  onSubmit,
  onClear,
  isLoading,
  direction,
  onDirectionChange,
  showNativeAlternative,
  includeNativeAlternative,
  onIncludeNativeAlternativeChange,
}: ComposerCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <Toggles
          characterSet={characterSet}
          onCharacterSetChange={onCharacterSetChange}
          voiceRegion={voiceRegion}
          onVoiceRegionChange={onVoiceRegionChange}
        />
        <TranslatorForm
          sourceText={sourceText}
          onSourceTextChange={onSourceTextChange}
          onSubmit={onSubmit}
          onClear={onClear}
          isLoading={isLoading}
          direction={direction}
          onDirectionChange={onDirectionChange}
        />
        {showNativeAlternative ? (
          <label className="flex w-fit items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={includeNativeAlternative}
              onChange={(event) =>
                onIncludeNativeAlternativeChange(event.target.checked)
              }
              className="size-4 rounded border-foreground/20"
            />
            Native alternative
          </label>
        ) : null}
      </CardContent>
    </Card>
  );
}