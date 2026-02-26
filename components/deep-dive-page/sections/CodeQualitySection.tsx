"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { ConfidenceIndicator } from "@/components/deep-dive/ConfidenceIndicator";
import { SourcesRow } from "../SourcesRow";
import type { CodeQuality } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CodeQualitySectionProps {
  codeQuality: CodeQuality;
}

function BooleanIndicator({
  value,
  label,
  detail,
}: {
  value: boolean;
  label: string;
  detail?: string | null;
}) {
  return (
    <div className="flex items-start gap-2">
      {value ? (
        <CheckCircle2
          className="mt-0.5 size-4 shrink-0 text-emerald-600"
          aria-label="Yes"
        />
      ) : (
        <XCircle
          className="mt-0.5 size-4 shrink-0 text-muted-foreground/40"
          aria-label="No"
        />
      )}
      <div className="min-w-0">
        <span
          className={cn(
            "text-sm",
            value ? "text-foreground" : "text-muted-foreground/60"
          )}
        >
          {label}
        </span>
        {detail && (
          <span className="ml-1.5 text-xs text-muted-foreground">
            ({detail})
          </span>
        )}
      </div>
    </div>
  );
}

export function CodeQualitySection({ codeQuality }: CodeQualitySectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h4 className="font-serif text-lg text-foreground">Code Quality</h4>
        <ConfidenceIndicator confidence={codeQuality.confidence} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <BooleanIndicator
          value={codeQuality.has_tests}
          label="Tests"
          detail={codeQuality.test_framework}
        />
        <BooleanIndicator
          value={codeQuality.has_ci}
          label="CI/CD"
          detail={codeQuality.ci_platform}
        />
        <BooleanIndicator
          value={codeQuality.has_linting}
          label="Linting"
          detail={codeQuality.linter}
        />
        <BooleanIndicator
          value={codeQuality.typescript_strict === true}
          label="TypeScript Strict"
        />
        <BooleanIndicator
          value={codeQuality.code_coverage_mentioned}
          label="Code Coverage"
        />
        {codeQuality.build_system && (
          <div className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-emerald-600"
              aria-label="Yes"
            />
            <div className="min-w-0">
              <span className="text-sm text-foreground">Build System</span>
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({codeQuality.build_system})
              </span>
            </div>
          </div>
        )}
      </div>

      <SourcesRow sources={codeQuality.sources} />
    </div>
  );
}
