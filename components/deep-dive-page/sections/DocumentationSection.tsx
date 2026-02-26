"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfidenceIndicator } from "@/components/deep-dive/ConfidenceIndicator";
import { SourcesRow } from "../SourcesRow";
import type { DocumentationQuality } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DocumentationSectionProps {
  documentation: DocumentationQuality;
}

function getGradeConfig(grade: DocumentationQuality["overall_grade"]) {
  const map = {
    comprehensive: {
      label: "Comprehensive",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    adequate: {
      label: "Adequate",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    },
    minimal: {
      label: "Minimal",
      className: "bg-red-50 text-red-700 border-red-200",
    },
    missing: {
      label: "Missing",
      className: "bg-gray-50 text-gray-500 border-gray-200",
    },
  } as const;
  return map[grade];
}

export function DocumentationSection({
  documentation,
}: DocumentationSectionProps) {
  const gradeConfig = getGradeConfig(documentation.overall_grade);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h4 className="font-serif text-lg text-foreground">Documentation</h4>
        <ConfidenceIndicator confidence={documentation.confidence} />
      </div>

      <div className="space-y-4">
        {/* Overall grade */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Overall:</span>
          <Badge
            variant="outline"
            className={cn("text-xs font-medium", gradeConfig.className)}
          >
            {gradeConfig.label}
          </Badge>
        </div>

        {/* README sections */}
        {documentation.readme_sections.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              README Sections
            </span>
            <div className="flex flex-wrap gap-1.5">
              {documentation.readme_sections.map((section) => (
                <Badge
                  key={section}
                  variant="outline"
                  className="text-xs font-normal border-border bg-muted/50 text-muted-foreground"
                >
                  {section}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Boolean indicators */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <BoolItem value={documentation.has_docs_directory} label="Docs Directory" />
          <BoolItem
            value={documentation.has_api_docs}
            label="API Docs"
            detail={documentation.api_docs_type}
          />
          <BoolItem value={documentation.has_examples} label="Examples" />
          <BoolItem value={documentation.has_changelog} label="Changelog" />
          <BoolItem value={documentation.has_tutorials} label="Tutorials" />
        </div>
      </div>

      <SourcesRow sources={documentation.sources} />
    </div>
  );
}

function BoolItem({
  value,
  label,
  detail,
}: {
  value: boolean;
  label: string;
  detail?: string | null;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      {value ? (
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-label="Yes" />
      ) : (
        <XCircle className="size-4 shrink-0 text-muted-foreground/40" aria-label="No" />
      )}
      <span
        className={cn(
          "text-sm",
          value ? "text-foreground" : "text-muted-foreground/60"
        )}
      >
        {label}
      </span>
      {detail && (
        <span className="text-xs text-muted-foreground">({detail})</span>
      )}
    </div>
  );
}
