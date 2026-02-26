"use client";

import { useState } from "react";
import { ExternalLink, Star, ChevronDown, ChevronUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { TableRow, TableCell } from "@/components/ui/table";
import { VerificationBadge } from "./VerificationBadge";
import { QualityTierBadge } from "./QualityTierBadge";
import { RedditSignalBadge } from "./RedditSignalBadge";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
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
  const searchMeta = useScoutStore((s) => s.searchMeta);

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
          "animate-slide-up transition-colors cursor-pointer hover:bg-muted/50",
          isSelected && "bg-teal/[0.03]",
          delayClass
        )}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        role="row"
      >
        <TableCell className="w-12 pr-0">
          <Checkbox
            checked={isSelected}
            disabled={isMaxSelected}
            onCheckedChange={() => toggleRepoSelection(repo.repo_url)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${repo.repo_name} for deep dive`}
            className="data-[state=checked]:bg-teal data-[state=checked]:border-teal"
          />
        </TableCell>

        <TableCell className="min-w-[220px]">
          <div className="flex items-center gap-2">
            <a
              href={repo.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-base font-semibold text-foreground hover:text-teal transition-colors break-words"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="break-all">{repo.repo_name}</span>
              <ExternalLink className="size-3.5 shrink-0 opacity-40 hover:opacity-100" aria-hidden="true" />
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

        <TableCell className="w-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-2 hover:bg-secondary rounded-md transition-colors"
            aria-label="Toggle details"
          >
            {expanded ? (
              <ChevronUp className="size-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
            )}
          </button>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="animate-slide-up bg-secondary/30">
          <TableCell colSpan={9} className="px-6 py-4">
            <div className="space-y-4">
              {repo.summary && (
                <div className="rounded-md bg-background/50 p-4 border border-border/50">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Repository Summary</h4>
                  <p className="text-sm leading-relaxed text-foreground">
                    {repo.summary}
                  </p>
                </div>
              )}

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

              {searchMeta && (
                <div className="pt-2">
                  <FeedbackWidget
                    searchId={searchMeta.id}
                    repoUrl={repo.repo_url}
                  />
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
