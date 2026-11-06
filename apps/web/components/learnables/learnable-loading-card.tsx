"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LearnableLoadingCard() {
  return (
    <Card data-testid="learnable-suggestions">
      <CardHeader>
        <CardTitle>New bits to learn</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Finding new bits to learn…
        </p>
      </CardContent>
    </Card>
  );
}
