"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SkillsSectionProps {
  skills: {
    technical: string[];
    design: string[];
    domain: string[];
  };
}

const skillGroups = [
  {
    key: "technical" as const,
    label: "Technical",
    pillClassName: "bg-teal/[0.08] text-teal border-teal/20",
  },
  {
    key: "design" as const,
    label: "Design",
    pillClassName: "bg-violet-50 text-violet-700 border-violet-200",
  },
  {
    key: "domain" as const,
    label: "Domain",
    pillClassName: "bg-amber-50 text-amber-700 border-amber-200",
  },
];

export function SkillsSection({ skills }: SkillsSectionProps) {
  const hasAnySkills =
    skills.technical.length > 0 ||
    skills.design.length > 0 ||
    skills.domain.length > 0;

  if (!hasAnySkills) return null;

  return (
    <div className="space-y-4">
      <h4 className="font-serif text-lg text-foreground">Skills Required</h4>

      <div className="space-y-3">
        {skillGroups.map(({ key, label, pillClassName }) => {
          const items = skills[key];
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
                    variant="outline"
                    className={cn("text-xs font-normal", pillClassName)}
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
