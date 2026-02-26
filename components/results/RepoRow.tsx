"use client";

import { useState } from "react";
import { ExternalLink, Star, ChevronDown, ChevronUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { TableRow, TableCell } from "@/components/ui/table";
import { VerificationBadge } from "./VerificationBadge";
import { QualityTierBadge } from "./QualityTierBadge";
import { RedditSignalBadge } from "./RedditSignalBadge";
import type { RepoResult } from "@/lib/types";
import { formatStarCount, formatRelativeDate } from "@/lib/verification";
import { useScoutStore } from "@/stores/scout-store";
import { cn } from "@/lib/utils";

interface RepoRowProps {
  repo: RepoResult;
  index: number;
}

function getLanguageClass(language: string | null): string {
  if (!language) return "lang-default";
  const key = language.toLowerCase().replace(/[^a-z]/g, "");
  const knownLangs = [
    "typescript",
    "javascript",
    "python",
    "rust",
    "go",
    "java",
    "ruby",
    "swift",
    "kotlin",
    "c",
    "cpp",
    "csharp",
    "php",
    "dart",
  ];
  if (key === "c++") return "lang-cpp";
  if (key === "c#") return "lang-csharp";
  return knownLangs.includes(key) ? `lang-${key}` : "lang-default";
}

export function RepoRow({ repo, index }: RepoRowProps) {
  const [expanded, setExpanded] = useState(false);
  const toggleRepoSelection = useScoutStore((s) => s.toggleRepoSelection);
  const selectedRepoUrls = useScoutStore((s) => s.selectedRepoUrls);

  const isSelected = selectedRepoUrls.includes(repo.repo_url);
  const isMaxSelected = selectedRepoUrls.length >= 5 && !isSelected;

  const delayClass =
    index < 8
      ? `delay-${index + 1}`
      : undefined;

  return (
    <>
      <TableRow
        className={cn(
          "animate-slide-up cursor-pointer transition-colors",
          isSelected && "bg-teal/[0.03]",
          delayClass
        )}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        role="row"
      >
        <TableCell className="w-10">
          <Checkbox
            checked={isSelected}
            disabled={isMaxSelected}
            onCheckedChange={() => toggleRepoSelection(repo.repo_url)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${repo.repo_name} for deep dive`}
          />
        </TableCell>

        <TableCell className="max-w-[200px]">
          <div className="flex items-center gap-2">
            <a
              href={repo.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 truncate font-mono text-sm font-medium text-foreground hover:text-teal transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {repo.repo_name}
              <ExternalLink className="size-3 shrink-0 opacity-40" aria-hidden="true" />
            </a>
          </div>
        </TableCell>

        <TableCell>
          {repo.stars !== null ? (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="size-3.5 fill-amber text-amber" aria-hidden="true" />
              {formatStarCount(repo.stars)}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">&mdash;</span>
          )}
        </TableCell>

        <TableCell>
          <span className="text-sm text-muted-foreground">
            {repo.last_commit
              ? formatRelativeDate(repo.last_commit)
              : "\u2014"}
          </span>
        </TableCell>

        <TableCell>
          {repo.primary_language ? (
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-block h-2.5 w-2.5 rounded-full",
                  getLanguageClass(repo.primary_language)
                )}
              />
              <span className="text-sm text-muted-foreground">
                {repo.primary_language}
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">&mdash;</span>
          )}
        </TableCell>

        <TableCell>
          <QualityTierBadge tier={repo.quality_tier} />
        </TableCell>

        <TableCell>
          <VerificationBadge verification={repo.verification} />
        </TableCell>

        <TableCell>
          <RedditSignalBadge
            signal={repo.reddit_signal}
            details={repo.verification.community.details}
          />
        </TableCell>

        <TableCell className="max-w-[240px]">
          <p className="truncate text-sm text-muted-foreground">
            {repo.summary}
          </p>
        </TableCell>

        <TableCell className="w-8">
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
          )}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="animate-slide-up bg-secondary/30">
          <TableCell colSpan={10} className="px-6 py-4">
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-foreground">
                {repo.summary}
              </p>

              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {repo.license && (
                  <span>
                    <span className="font-medium text-foreground">
                      License:
                    </span>{" "}
                    {repo.license}
                  </span>
                )}
                {repo.verification.freshness.status && (
                  <span>
                    <span className="font-medium text-foreground">
                      Freshness:
                    </span>{" "}
                    {repo.verification.freshness.status}
                  </span>
                )}
                {repo.source_strategies.length > 0 && (
                  <span>
                    <span className="font-medium text-foreground">
                      Found via:
                    </span>{" "}
                    {repo.source_strategies.join(", ")}
                  </span>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
