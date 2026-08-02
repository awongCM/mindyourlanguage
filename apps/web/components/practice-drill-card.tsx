"use client";

import { Button } from "@/components/ui/button";
import { ShadowingPlayer } from "@/components/shadowing-player";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  PhrasebookEntry,
  ReviewGrade,
  VoiceRegion,
} from "@mindyourlanguage/shared";

interface PracticeDrillCardProps {
  entry: PhrasebookEntry;
  revealed: boolean;
  onReveal: () => void;
  onGrade: (grade: ReviewGrade) => void;
  voiceRegion: VoiceRegion;
}

const GRADES: { grade: ReviewGrade; label: string }[] = [
  { grade: "again", label: "Again" },
  { grade: "hard", label: "Hard" },
  { grade: "good", label: "Good" },
  { grade: "easy", label: "Easy" },
];

export function PracticeDrillCard({
  entry,
  revealed,
  onReveal,
  onGrade,
  voiceRegion,
}: PracticeDrillCardProps) {
  return (
    <Card data-testid="practice-drill-card">
      <CardHeader>
        <CardTitle>Recall</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-lg leading-relaxed text-foreground" data-testid="drill-prompt">
          {entry.sourceText}
        </p>
        {revealed ? (
          <div className="flex flex-col gap-3" data-testid="drill-answer">
            <p className="text-xl font-medium text-foreground">
              {entry.translation}
            </p>
            {entry.pinyin ? (
              <p className="text-sm text-muted-foreground" lang="zh-Latn">
                {entry.pinyin}
              </p>
            ) : null}
            <ShadowingPlayer
              text={entry.translation}
              segments={entry.segments}
              region={voiceRegion}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Say or write the Mandarin, then reveal.
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {!revealed ? (
          <Button type="button" onClick={onReveal} data-testid="drill-reveal">
            Reveal
          </Button>
        ) : (
          GRADES.map(({ grade, label }) => (
            <Button
              key={grade}
              type="button"
              variant={grade === "good" ? "default" : "outline"}
              size="sm"
              onClick={() => onGrade(grade)}
              data-testid={`grade-${grade}`}
            >
              {label}
            </Button>
          ))
        )}
      </CardFooter>
    </Card>
  );
}
