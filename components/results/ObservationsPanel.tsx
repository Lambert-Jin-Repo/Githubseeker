"use client";

import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScoutStore } from "@/stores/scout-store";

export function ObservationsPanel() {
  const observations = useScoutStore((s) => s.observations);

  if (observations.length === 0) return null;

  return (
    <Card className="animate-slide-up border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="size-4 text-amber" />
          <span className="font-serif">Observations</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {observations.map((obs, idx) => (
            <p
              key={idx}
              className="animate-slide-in text-sm leading-relaxed text-muted-foreground"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {obs}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
