"use client";

import { Badge } from "@/components/ui/badge";
import { ConfidenceIndicator } from "./ConfidenceIndicator";
import { cn } from "@/lib/utils";

interface TechStackSectionProps {
  techStack: {
    languages: string[];
    frameworks: string[];
    infrastructure: string[];
    key_dependencies: string[];
    confidence: "high" | "medium" | "low";
  };
}

const groups = [
  { key: "languages" as const, label: "Languages" },
  { key: "frameworks" as const, label: "Frameworks" },
  { key: "infrastructure" as const, label: "Infrastructure" },
  { key: "key_dependencies" as const, label: "Key Dependencies" },
];

export function TechStackSection({ techStack }: TechStackSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h4 className="font-serif text-lg text-foreground">Tech Stack</h4>
        <ConfidenceIndicator confidence={techStack.confidence} />
      </div>

      <div className="space-y-3">
        {groups.map(({ key, label }) => {
          const items = techStack[key];
          if (items.length === 0) return null;

          return (
            <div key={key} className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item) => (
                  <Badge
                    key={item}
                    variant="secondary"
                    className={cn(
                      "text-xs font-normal",
                      "bg-secondary/80 text-secondary-foreground"
                    )}
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
