"use client";

import {
  ExternalLink,
  Star,
  Users,
  Scale,
  Clock,
  BookOpen,
  Hammer,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfidenceIndicator } from "@/components/deep-dive/ConfidenceIndicator";
import { AIPatternsSection } from "@/components/deep-dive/AIPatternsSection";
import { SkillsSection } from "@/components/deep-dive/SkillsSection";
import { AgentEcosystemSection } from "@/components/deep-dive/AgentEcosystemSection";
import { SourcesRow } from "./SourcesRow";
import { EnhancedSectionDisplay } from "./sections/EnhancedSectionDisplay";
import { TechStackSectionV2 } from "./sections/TechStackSectionV2";
import { CodeQualitySection } from "./sections/CodeQualitySection";
import { CommunityHealthSection } from "./sections/CommunityHealthSection";
import { DocumentationSection } from "./sections/DocumentationSection";
import { SecuritySection } from "./sections/SecuritySection";
import { GettingStartedSection } from "./sections/GettingStartedSection";
import type { DeepDiveResultV2, ScoutMode } from "@/lib/types";
import { formatStarCount, formatRelativeDate } from "@/lib/verification";
import { cn } from "@/lib/utils";

interface RepoAnalysisCardProps {
  result: DeepDiveResultV2;
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

const modeConfig = {
  LEARN: { heading: "Learning Guide", icon: BookOpen },
  BUILD: { heading: "Build Guide", icon: Hammer },
  SCOUT: { heading: "Market Analysis", icon: TrendingUp },
} as const;

export function RepoAnalysisCard({
  result,
  mode,
  index,
}: RepoAnalysisCardProps) {
  const ModeIcon = modeConfig[mode].icon;

  return (
    <Card
      className="animate-slide-up overflow-hidden rounded-lg border border-border/50 bg-card py-4 sm:py-6"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* ── Header ── */}
      <CardHeader className="pb-2 px-4 sm:px-6">
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
              <ExternalLink
                className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden="true"
              />
            </a>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground sm:gap-x-4">
            {/* Stars */}
            <div className="flex items-center gap-1">
              <Star
                className="size-3.5 fill-amber text-amber"
                aria-hidden="true"
              />
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
        </div>
      </CardHeader>

      {/* ── Sections ── */}
      <CardContent className="divide-y divide-border/30 px-4 sm:px-6">
        {/* 1. Overview */}
        <div className="py-5 first:pt-0">
          <EnhancedSectionDisplay section={result.overview} />
        </div>

        {/* 2. Why It Stands Out */}
        <div className="py-5">
          <EnhancedSectionDisplay section={result.why_it_stands_out} />
        </div>

        {/* 3. Tech Stack */}
        <div className="py-5">
          <TechStackSectionV2 techStack={result.tech_stack} />
        </div>

        {/* 4. Architecture */}
        <div className="py-5">
          <EnhancedSectionDisplay section={result.architecture} />
        </div>

        {/* 5. Code Quality */}
        <div className="py-5">
          <CodeQualitySection codeQuality={result.code_quality} />
        </div>

        {/* 6. Community Health */}
        <div className="py-5">
          <CommunityHealthSection communityHealth={result.community_health} />
        </div>

        {/* 7. Documentation */}
        <div className="py-5">
          <DocumentationSection documentation={result.documentation_quality} />
        </div>

        {/* 8. Security */}
        <div className="py-5">
          <SecuritySection security={result.security_posture} />
        </div>

        {/* 9. AI Patterns */}
        <div className="py-5">
          <AIPatternsSection patterns={result.ai_patterns} />
          {result.ai_patterns.sources?.length > 0 && (
            <div className="mt-3">
              <SourcesRow sources={result.ai_patterns.sources} />
            </div>
          )}
        </div>

        {/* 10. Skills Required */}
        <div className="py-5">
          <SkillsSection skills={result.skills_required} />
        </div>

        {/* 10b. Agent Ecosystem */}
        {result.agent_ecosystem && (
          <div className="py-5">
            <AgentEcosystemSection ecosystem={result.agent_ecosystem} />
          </div>
        )}

        {/* 11. Getting Started */}
        <div className="py-5">
          <GettingStartedSection gettingStarted={result.getting_started} />
        </div>

        {/* 12. Mode-Specific */}
        <div className="py-5">
          <EnhancedSectionDisplay
            section={result.mode_specific}
            headingOverride={
              <h4 className="flex items-center gap-2 font-serif text-lg text-foreground">
                <ModeIcon className="size-4 text-teal" />
                {modeConfig[mode].heading}
              </h4>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
