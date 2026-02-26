"use client";

import {
  Lightbulb,
  Target,
  Route,
  AlertTriangle,
  Bot,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ScoutSummary, ScoutMode } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SummaryPanelProps {
  summary: ScoutSummary;
  mode: ScoutMode;
}

export function SummaryPanel({ summary, mode }: SummaryPanelProps) {
  return (
    <Card className="animate-slide-up border-border/60 overflow-hidden">
      <CardHeader>
        <CardTitle className="font-serif text-2xl text-foreground">
          Summary
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Key Takeaways */}
        {summary.takeaways.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-4 text-amber" />
              <h4 className="font-serif text-lg text-foreground">
                Key Takeaways
              </h4>
            </div>
            <ol className="space-y-3 pl-1">
              {summary.takeaways.map((takeaway, idx) => (
                <li key={idx} className="flex gap-3 text-sm leading-relaxed">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-teal/10 text-xs font-semibold text-teal">
                    {idx + 1}
                  </span>
                  <span className="text-muted-foreground">{takeaway}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <Separator />

        {/* Recommendations */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-teal" />
            <h4 className="font-serif text-lg text-foreground">
              Recommendations
            </h4>
          </div>

          <div className="space-y-3">
            {mode === "LEARN" && summary.recommendations.learning && (
              <div className="rounded-lg border border-border/60 bg-secondary/30 p-4">
                <p className="text-sm font-medium text-foreground">
                  Start with{" "}
                  <span className="font-mono text-teal">
                    {summary.recommendations.learning.repo}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {summary.recommendations.learning.reason}
                </p>
              </div>
            )}

            {mode === "BUILD" && summary.recommendations.building && (
              <div className="rounded-lg border border-border/60 bg-secondary/30 p-4">
                <p className="text-sm font-medium text-foreground">
                  Reference{" "}
                  <span className="font-mono text-teal">
                    {summary.recommendations.building.repo}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {summary.recommendations.building.reason}
                </p>
              </div>
            )}

            {mode === "SCOUT" && summary.recommendations.scouting && (
              <div className="rounded-lg border border-border/60 bg-secondary/30 p-4">
                <p className="text-sm text-muted-foreground">
                  {summary.recommendations.scouting.insight}
                </p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Skills Roadmap */}
        {summary.skills_roadmap.length > 0 && (
          <>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Route className="size-4 text-teal" />
                <h4 className="font-serif text-lg text-foreground">
                  Skills Roadmap
                </h4>
              </div>

              <div className="relative pl-6">
                {/* Connecting line */}
                <div className="absolute left-[9px] top-2 bottom-2 w-px bg-teal/20" />

                <div className="space-y-4">
                  {summary.skills_roadmap.map((skill, idx) => (
                    <div key={idx} className="relative flex items-start gap-3">
                      {/* Step dot */}
                      <div
                        className={cn(
                          "absolute -left-6 mt-1 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2",
                          idx === 0
                            ? "border-teal bg-teal text-white"
                            : "border-teal/30 bg-card text-teal/60"
                        )}
                      >
                        <span className="text-[9px] font-bold">
                          {idx + 1}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {skill}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Separator />
          </>
        )}

        {/* Gaps Discovered */}
        {summary.gaps_discovered.length > 0 && (
          <>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-warning" />
                <h4 className="font-serif text-lg text-foreground">
                  Gaps Discovered
                </h4>
              </div>

              <div className="space-y-2">
                {summary.gaps_discovered.map((gap, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-md border border-amber-200/60 bg-amber-50/50 px-3 py-2.5"
                  >
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber" />
                    <p className="text-sm text-amber-800">{gap}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />
          </>
        )}

        {/* AI Ecosystem Notes */}
        {summary.ai_ecosystem_notes && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Bot className="size-4 text-teal" />
              <h4 className="font-serif text-lg text-foreground">
                AI Ecosystem Notes
              </h4>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {summary.ai_ecosystem_notes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
