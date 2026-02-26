"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfidenceIndicator } from "@/components/deep-dive/ConfidenceIndicator";
import { SourcesRow } from "../SourcesRow";
import type { CommunityHealth } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CommunityHealthSectionProps {
  communityHealth: CommunityHealth;
}

function getFreshnessColor(days: number): string {
  if (days < 7) return "text-emerald-600";
  if (days < 30) return "text-amber-600";
  return "text-red-600";
}

function getBusFactorConfig(estimate: "low" | "medium" | "high") {
  const map = {
    low: { label: "Low", className: "bg-red-50 text-red-700 border-red-200" },
    medium: {
      label: "Medium",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    },
    high: {
      label: "High",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
  } as const;
  return map[estimate];
}

export function CommunityHealthSection({
  communityHealth,
}: CommunityHealthSectionProps) {
  const hasIssueData =
    communityHealth.open_issues !== null &&
    communityHealth.closed_issues !== null;
  const totalIssues = hasIssueData
    ? (communityHealth.open_issues ?? 0) + (communityHealth.closed_issues ?? 0)
    : 0;
  const closedRatio =
    totalIssues > 0 ? ((communityHealth.closed_issues ?? 0) / totalIssues) * 100 : 0;

  const busConfig = getBusFactorConfig(communityHealth.bus_factor_estimate);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h4 className="font-serif text-lg text-foreground">
          Community Health
        </h4>
        <ConfidenceIndicator confidence={communityHealth.confidence} />
      </div>

      <div className="space-y-4">
        {/* Issues ratio */}
        {hasIssueData && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Issues</span>
              <span className="text-foreground">
                {communityHealth.open_issues?.toLocaleString()} open /{" "}
                {communityHealth.closed_issues?.toLocaleString()} closed
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={closedRatio}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${Math.round(closedRatio)}% of issues closed`}
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${closedRatio}%` }}
              />
            </div>
          </div>
        )}

        {/* Metrics grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Contributors */}
          {communityHealth.contributors !== null && (
            <div className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
              <span className="text-sm text-muted-foreground">
                Contributors
              </span>
              <span className="text-sm font-medium text-foreground">
                {communityHealth.contributors.toLocaleString()}
              </span>
            </div>
          )}

          {/* Last commit */}
          {communityHealth.last_commit_days_ago !== null && (
            <div className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
              <span className="text-sm text-muted-foreground">
                Last Commit
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  getFreshnessColor(communityHealth.last_commit_days_ago)
                )}
              >
                {communityHealth.last_commit_days_ago === 0
                  ? "Today"
                  : communityHealth.last_commit_days_ago === 1
                    ? "1 day ago"
                    : `${communityHealth.last_commit_days_ago} days ago`}
              </span>
            </div>
          )}

          {/* Contributing guide */}
          <div className="flex items-center gap-2 px-1">
            {communityHealth.has_contributing_guide ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-label="Yes" />
            ) : (
              <XCircle className="size-4 shrink-0 text-muted-foreground/40" aria-label="No" />
            )}
            <span
              className={cn(
                "text-sm",
                communityHealth.has_contributing_guide
                  ? "text-foreground"
                  : "text-muted-foreground/60"
              )}
            >
              Contributing Guide
            </span>
          </div>

          {/* Code of conduct */}
          <div className="flex items-center gap-2 px-1">
            {communityHealth.has_code_of_conduct ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-label="Yes" />
            ) : (
              <XCircle className="size-4 shrink-0 text-muted-foreground/40" aria-label="No" />
            )}
            <span
              className={cn(
                "text-sm",
                communityHealth.has_code_of_conduct
                  ? "text-foreground"
                  : "text-muted-foreground/60"
              )}
            >
              Code of Conduct
            </span>
          </div>
        </div>

        {/* Bus factor */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Bus Factor:</span>
          <Badge
            variant="outline"
            className={cn("text-xs font-medium", busConfig.className)}
          >
            {busConfig.label}
          </Badge>
        </div>
      </div>

      <SourcesRow sources={communityHealth.sources} />
    </div>
  );
}
