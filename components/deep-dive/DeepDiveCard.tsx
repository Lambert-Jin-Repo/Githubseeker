"use client";

import { useState } from "react";
import {
  ExternalLink,
  Star,
  Users,
  Scale,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConfidenceIndicator } from "./ConfidenceIndicator";
import { TechStackSection } from "./TechStackSection";
import { ArchitectureSection } from "./ArchitectureSection";
import { AIPatternsSection } from "./AIPatternsSection";
import { SkillsSection } from "./SkillsSection";
import { ModeSpecificSection } from "./ModeSpecificSection";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { useScoutStore } from "@/stores/scout-store";
import type { DeepDiveResult, DeepDiveSection, ScoutMode } from "@/lib/types";
import { formatStarCount, formatRelativeDate } from "@/lib/verification";
import { cn } from "@/lib/utils";

interface DeepDiveCardProps {
  result: DeepDiveResult;
  mode: ScoutMode;
  index: number;
}

function getLanguageDotClass(language: string): string {
  const key = language.toLowerCase().replace(/[^a-z+#]/g, "");
  const mapping: Record<string, string> = {
    typescript: "lang-typescript",
    javascript: "lang-javascript",
    python: "lang-python",
    rust: "lang-rust",
    go: "lang-go",
    java: "lang-java",
    ruby: "lang-ruby",
    swift: "lang-swift",
    kotlin: "lang-kotlin",
    c: "lang-c",
    "c++": "lang-cpp",
    cpp: "lang-cpp",
    "c#": "lang-csharp",
    csharp: "lang-csharp",
    php: "lang-php",
    dart: "lang-dart",
  };
  return mapping[key] ?? "lang-default";
}

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 py-2 text-left transition-colors hover:text-teal min-h-[44px]"
        aria-expanded={isOpen}
        aria-label={`${isOpen ? "Collapse" : "Expand"} ${title} section`}
      >
        {isOpen ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
      </button>
      {isOpen && <div className="pt-3">{children}</div>}
    </div>
  );
}

function ContentSection({ section }: { section: DeepDiveSection }) {
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

export function DeepDiveCard({ result, mode, index }: DeepDiveCardProps) {
  const searchMeta = useScoutStore((s) => s.searchMeta);
  const delayClass = index < 8 ? `delay-${index + 1}` : undefined;

  return (
    <Card
      className={cn(
        "animate-slide-up overflow-hidden border-border/60",
        delayClass
      )}
    >
      {/* Header */}
      <CardHeader className="pb-2">
        <div className="space-y-3">
          {/* Repo name and link */}
          <div className="flex items-start justify-between gap-2 sm:gap-4">
            <a
              href={result.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 min-w-0"
              aria-label={`${result.repo_name} — open on GitHub`}
            >
              <h3 className="font-serif text-xl sm:text-2xl text-foreground transition-colors group-hover:text-teal break-words">
                {result.repo_name}
              </h3>
              <ExternalLink className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </a>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground sm:gap-x-4">
            {/* Stars */}
            <div className="flex items-center gap-1">
              <Star className="size-3.5 fill-amber text-amber" aria-hidden="true" />
              <span>{formatStarCount(result.stars)}</span>
            </div>

            {/* Contributors */}
            {result.contributors !== null && (
              <div className="flex items-center gap-1">
                <Users className="size-3.5" aria-hidden="true" />
                <span>
                  {result.contributors.toLocaleString()} contributor
                  {result.contributors !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            {/* Language */}
            {result.primary_language && (
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-block size-2.5 rounded-full",
                    getLanguageDotClass(result.primary_language)
                  )}
                  aria-hidden="true"
                />
                <span>{result.primary_language}</span>
              </div>
            )}

            {/* License */}
            {result.license && (
              <div className="flex items-center gap-1">
                <Scale className="size-3.5" aria-hidden="true" />
                <span>{result.license}</span>
              </div>
            )}

            {/* Last updated */}
            {result.last_updated && (
              <div className="flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden="true" />
                <span>Updated {formatRelativeDate(result.last_updated)}</span>
              </div>
            )}
          </div>

          {/* Feedback */}
          {searchMeta && (
            <FeedbackWidget
              searchId={searchMeta.id}
              repoUrl={result.repo_url}
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-0">
        {/* What It Does */}
        <CollapsibleSection title="What It Does">
          <ContentSection section={result.what_it_does} />
        </CollapsibleSection>

        <Separator className="my-4" />

        {/* Why It Stands Out */}
        <CollapsibleSection title="Why It Stands Out">
          <ContentSection section={result.why_it_stands_out} />
        </CollapsibleSection>

        <Separator className="my-4" />

        {/* Tech Stack */}
        <CollapsibleSection title="Tech Stack">
          <TechStackSection techStack={result.tech_stack} />
        </CollapsibleSection>

        <Separator className="my-4" />

        {/* Architecture */}
        <CollapsibleSection title="Architecture">
          <ArchitectureSection section={result.architecture} />
        </CollapsibleSection>

        <Separator className="my-4" />

        {/* AI Patterns */}
        <CollapsibleSection title="AI Patterns">
          <AIPatternsSection patterns={result.ai_patterns} />
        </CollapsibleSection>

        <Separator className="my-4" />

        {/* Skills Required */}
        <CollapsibleSection title="Skills Required">
          <SkillsSection skills={result.skills_required} />
        </CollapsibleSection>

        <Separator className="my-4" />

        {/* Mode-Specific Section */}
        <CollapsibleSection
          title={
            mode === "LEARN"
              ? "Learning Guide"
              : mode === "BUILD"
                ? "Build Guide"
                : "Market Analysis"
          }
        >
          <ModeSpecificSection section={result.mode_specific} mode={mode} />
        </CollapsibleSection>
      </CardContent>
    </Card>
  );
}
