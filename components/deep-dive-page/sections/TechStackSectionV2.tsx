"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfidenceIndicator } from "@/components/deep-dive/ConfidenceIndicator";
import { SourcesRow } from "../SourcesRow";
import { cn } from "@/lib/utils";
import type { DeepDiveResultV2 } from "@/lib/types";

interface TechStackSectionV2Props {
  techStack: DeepDiveResultV2["tech_stack"];
}

function DependencyBadge({
  name,
  version,
  url,
}: {
  name: string;
  version?: string;
  url?: string;
}) {
  const content = (
    <>
      {name}
      {version && (
        <span className="ml-0.5 text-[10px] opacity-70">v{version}</span>
      )}
      {url && (
        <ExternalLink className="ml-0.5 size-2.5 opacity-50" aria-hidden="true" />
      )}
    </>
  );

  if (url) {
    return (
      <Badge
        variant="secondary"
        asChild
        className={cn(
          "text-xs font-normal cursor-pointer",
          "bg-secondary/80 text-secondary-foreground hover:bg-secondary"
        )}
      >
        <a href={url} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs font-normal",
        "bg-secondary/80 text-secondary-foreground"
      )}
    >
      {content}
    </Badge>
  );
}

export function TechStackSectionV2({ techStack }: TechStackSectionV2Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h4 className="font-serif text-lg text-foreground">Tech Stack</h4>
        <ConfidenceIndicator confidence={techStack.confidence} />
      </div>

      <div className="space-y-3">
        {/* Languages */}
        {techStack.languages.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Languages
            </span>
            <div className="flex flex-wrap gap-1.5">
              {techStack.languages.map((lang) => (
                <Badge
                  key={lang}
                  variant="secondary"
                  className="text-xs font-normal bg-secondary/80 text-secondary-foreground"
                >
                  {lang}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Frameworks */}
        {techStack.frameworks.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Frameworks
            </span>
            <div className="flex flex-wrap gap-1.5">
              {techStack.frameworks.map((fw) => (
                <DependencyBadge
                  key={fw.name}
                  name={fw.name}
                  version={fw.version}
                  url={fw.url}
                />
              ))}
            </div>
          </div>
        )}

        {/* Infrastructure */}
        {techStack.infrastructure.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Infrastructure
            </span>
            <div className="flex flex-wrap gap-1.5">
              {techStack.infrastructure.map((item) => (
                <Badge
                  key={item}
                  variant="secondary"
                  className="text-xs font-normal bg-secondary/80 text-secondary-foreground"
                >
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Key Dependencies */}
        {techStack.key_dependencies.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Key Dependencies
            </span>
            <div className="flex flex-wrap gap-1.5">
              {techStack.key_dependencies.map((dep) => (
                <DependencyBadge
                  key={dep.name}
                  name={dep.name}
                  version={dep.version}
                  url={dep.url}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <SourcesRow sources={techStack.sources} />
    </div>
  );
}
