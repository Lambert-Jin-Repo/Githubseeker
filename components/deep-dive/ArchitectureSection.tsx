"use client";

import { ExternalLink } from "lucide-react";
import { ConfidenceIndicator } from "./ConfidenceIndicator";
import type { DeepDiveSection } from "@/lib/types";

interface ArchitectureSectionProps {
  section: DeepDiveSection;
}

export function ArchitectureSection({ section }: ArchitectureSectionProps) {
  const paragraphs = section.content
    .split(/\n\n+/)
    .filter((p) => p.trim().length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h4 className="font-serif text-lg text-foreground">{section.title}</h4>
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

      {section.source && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
          <ExternalLink className="size-3" />
          <span>Source: {section.source}</span>
        </div>
      )}
    </div>
  );
}
