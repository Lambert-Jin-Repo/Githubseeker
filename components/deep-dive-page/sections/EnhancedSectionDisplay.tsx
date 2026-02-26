"use client";

import { ConfidenceIndicator } from "@/components/deep-dive/ConfidenceIndicator";
import { SourcesRow } from "../SourcesRow";
import type { EnhancedSection } from "@/lib/types";

interface EnhancedSectionDisplayProps {
  section: EnhancedSection;
  /** Override the heading rendered above the section content */
  headingOverride?: React.ReactNode;
}

export function EnhancedSectionDisplay({
  section,
  headingOverride,
}: EnhancedSectionDisplayProps) {
  const paragraphs = section.content
    .split(/\n\n+/)
    .filter((p) => p.trim().length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        {headingOverride ?? (
          <h4 className="font-serif text-lg text-foreground">
            {section.title}
          </h4>
        )}
        <ConfidenceIndicator confidence={section.confidence} />
      </div>

      <div className="space-y-3">
        {paragraphs.map((paragraph, idx) => (
          <p
            key={idx}
            className="text-sm leading-relaxed text-muted-foreground"
          >
            {paragraph.trim()}
          </p>
        ))}
      </div>

      <SourcesRow sources={section.sources} />
    </div>
  );
}
