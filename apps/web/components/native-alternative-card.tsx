"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toTraditionalChars } from "@/lib/characters";
import { registerLabel } from "@/lib/native-alternative-shared";
import type { CharacterSet, Register } from "@mindyourlanguage/shared";

interface NativeAlternativeCardProps {
  alternative: string;
  register: Register;
  note?: string;
  characterSet: CharacterSet;
}

export function NativeAlternativeCard({
  alternative,
  register,
  note,
  characterSet,
}: NativeAlternativeCardProps) {
  const displayText =
    characterSet === "traditional" ? toTraditionalChars(alternative) : alternative;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Native alternative</CardTitle>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {registerLabel(register)}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-lg leading-relaxed text-foreground">{displayText}</p>
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      </CardContent>
    </Card>
  );
}
