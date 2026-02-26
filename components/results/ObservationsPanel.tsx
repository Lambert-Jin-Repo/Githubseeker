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
          <Lightbulb className="size-4 text-amber" aria-hidden="true" />
          <span className="font-serif">Observations</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-4" aria-live="polite">
          {observations.map((obs, idx) => (
            <div
              key={idx}
              className="break-inside-avoid animate-slide-in rounded-lg bg-muted/40 p-4 border border-border/40"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <p className="text-sm leading-relaxed text-muted-foreground">
                {obs}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
