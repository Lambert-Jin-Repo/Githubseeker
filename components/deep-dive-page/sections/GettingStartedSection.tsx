"use client";

import { AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfidenceIndicator } from "@/components/deep-dive/ConfidenceIndicator";
import { SourcesRow } from "../SourcesRow";
import type { GettingStarted } from "@/lib/types";

interface GettingStartedSectionProps {
  gettingStarted: GettingStarted;
}

export function GettingStartedSection({
  gettingStarted,
}: GettingStartedSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h4 className="font-serif text-lg text-foreground">Getting Started</h4>
        <ConfidenceIndicator confidence={gettingStarted.confidence} />
      </div>

      <div className="space-y-5">
        {/* Estimated setup time */}
        {gettingStarted.estimated_setup_time && (
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-teal" aria-hidden="true" />
            <span className="text-sm text-muted-foreground">
              Estimated setup:
            </span>
            <Badge
              variant="outline"
              className="text-xs font-medium bg-teal/[0.08] text-teal border-teal/20"
            >
              {gettingStarted.estimated_setup_time}
            </Badge>
          </div>
        )}

        {/* Prerequisites */}
        {gettingStarted.prerequisites.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Prerequisites
            </span>
            <ul className="space-y-1 pl-4">
              {gettingStarted.prerequisites.map((prereq, idx) => (
                <li
                  key={idx}
                  className="list-disc text-sm text-muted-foreground"
                >
                  {prereq}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Install commands */}
        {gettingStarted.install_commands.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Install
            </span>
            <div className="space-y-1.5">
              {gettingStarted.install_commands.map((cmd, idx) => (
                <code
                  key={idx}
                  className="block rounded-md border border-border/60 bg-muted/50 px-3 py-2 font-mono text-sm text-foreground"
                >
                  {cmd}
                </code>
              ))}
            </div>
          </div>
        )}

        {/* First run command */}
        {gettingStarted.first_run_command && (
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Run
            </span>
            <code className="block rounded-md border border-border/60 bg-muted/50 px-3 py-2 font-mono text-sm text-foreground">
              {gettingStarted.first_run_command}
            </code>
          </div>
        )}

        {/* Env setup steps */}
        {gettingStarted.env_setup_steps.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Environment Setup
            </span>
            <ol className="space-y-1.5 pl-5">
              {gettingStarted.env_setup_steps.map((step, idx) => (
                <li
                  key={idx}
                  className="list-decimal text-sm text-muted-foreground"
                >
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Common pitfalls */}
        {gettingStarted.common_pitfalls.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Common Pitfalls
            </span>
            <div className="space-y-2">
              {gettingStarted.common_pitfalls.map((pitfall, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-amber-600"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-amber-800">{pitfall}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <SourcesRow sources={gettingStarted.sources} />
    </div>
  );
}
