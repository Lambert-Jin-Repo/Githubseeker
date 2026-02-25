"use client";

import { BookOpen, Hammer, TrendingUp } from "lucide-react";
import { ConfidenceIndicator } from "./ConfidenceIndicator";
import type { DeepDiveSection, ScoutMode } from "@/lib/types";

interface ModeSpecificSectionProps {
  section: DeepDiveSection;
  mode: ScoutMode;
}

const modeConfig = {
  LEARN: {
    heading: "Learning Guide",
    icon: BookOpen,
  },
  BUILD: {
    heading: "Build Guide",
    icon: Hammer,
  },
  SCOUT: {
    heading: "Market Analysis",
    icon: TrendingUp,
  },
} as const;

export function ModeSpecificSection({
  section,
  mode,
}: ModeSpecificSectionProps) {
  const config = modeConfig[mode];
  const Icon = config.icon;

  const paragraphs = section.content
    .split(/\n\n+/)
    .filter((p) => p.trim().length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h4 className="flex items-center gap-2 font-serif text-lg text-foreground">
          <Icon className="size-4 text-teal" />
          {config.heading}
        </h4>
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
    </div>
  );
}
