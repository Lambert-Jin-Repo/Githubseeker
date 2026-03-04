"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ArrowUpDown, Filter, X, ExternalLink, Star } from "lucide-react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RepoRow } from "./RepoRow";
import { RepoRowSkeleton } from "@/components/shared/LoadingSkeleton";
import { VerificationBadge } from "./VerificationBadge";
import { QualityTierBadge } from "./QualityTierBadge";
import { useScoutStore } from "@/stores/scout-store";
import { useHotkeys } from "@/hooks/useHotkeys";
import { getOverallVerificationStatus, formatStarCount, formatRelativeDate } from "@/lib/verification";
import type { QualityTier, RepoResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = "stars" | "last_commit" | "quality_tier";
type SortDir = "asc" | "desc";

export function QuickScanTable() {
  const repos = useScoutStore((s) => s.repos);
  const isSearching = useScoutStore((s) => s.isSearching);
  const phase1Complete = useScoutStore((s) => s.phase1Complete);
  const searchMeta = useScoutStore((s) => s.searchMeta);

  const [sortKey, setSortKey] = useState<SortKey>("stars");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<QualityTier | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Keyboard navigation state
  const [kbSelectedIndex, setKbSelectedIndex] = useState<number>(-1);
  const tableRef = useRef<HTMLDivElement>(null);

  const languages = useMemo(() => {
    const langs = new Set<string>();
    repos.forEach((r) => {
      if (r.primary_language) langs.add(r.primary_language);
    });
    return Array.from(langs).sort();
  }, [repos]);

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey]
  );

  const filteredAndSorted = useMemo(() => {
    let filtered = [...repos];

    if (languageFilter) {
      filtered = filtered.filter(
        (r) => r.primary_language === languageFilter
      );
    }

    if (tierFilter) {
      filtered = filtered.filter((r) => r.quality_tier === tierFilter);
    }

    if (verifiedOnly) {
      filtered = filtered.filter(
        (r) =>
          getOverallVerificationStatus(r.verification) === "fully_verified"
      );
    }

    filtered.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;

      switch (sortKey) {
        case "stars": {
          const aStars = a.stars ?? 0;
          const bStars = b.stars ?? 0;
          return (aStars - bStars) * dir;
        }
        case "last_commit": {
          const aDate = a.last_commit
            ? new Date(a.last_commit).getTime()
            : 0;
          const bDate = b.last_commit
            ? new Date(b.last_commit).getTime()
            : 0;
          return (aDate - bDate) * dir;
        }
        case "quality_tier": {
          return (a.quality_tier - b.quality_tier) * dir;
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [repos, languageFilter, tierFilter, verifiedOnly, sortKey, sortDir]);

  const hasActiveFilters = languageFilter || tierFilter || verifiedOnly;

  const SortableHead = ({
    label,
    sortKeyName,
    className,
  }: {
    label: string;
    sortKeyName: SortKey;
    className?: string;
  }) => (
    <TableHead className={className}>
      <button
        className="inline-flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors"
        onClick={() => toggleSort(sortKeyName)}
        aria-label={`Sort by ${label}, currently ${sortKey === sortKeyName ? sortDir + "ending" : "unsorted"}`}
      >
        {label}
        <ArrowUpDown
          className={cn(
            "size-3",
            sortKey === sortKeyName
              ? "text-teal"
              : "text-muted-foreground/50"
          )}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  );

  const clearAllFilters = useCallback(() => {
    setLanguageFilter(null);
    setTierFilter(null);
    setVerifiedOnly(false);
  }, []);

  // Reset keyboard selection when filter/sort changes
  useEffect(() => {
    setKbSelectedIndex(-1);
  }, [languageFilter, tierFilter, verifiedOnly, sortKey, sortDir]);

  // Scroll selected row into view
  useEffect(() => {
    if (kbSelectedIndex < 0) return;
    const row = tableRef.current?.querySelector(
      `[data-kb-index="${kbSelectedIndex}"]`
    );
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [kbSelectedIndex]);

  // Keyboard shortcuts for results page: j/k/Enter/e
  useHotkeys(
    {
      j: () => {
        setKbSelectedIndex((prev) => {
          const max = filteredAndSorted.length - 1;
          if (max < 0) return -1;
          return prev < max ? prev + 1 : max;
        });
      },
      k: () => {
        setKbSelectedIndex((prev) => {
          if (prev <= 0) return 0;
          return prev - 1;
        });
      },
      Enter: () => {
        if (kbSelectedIndex >= 0 && kbSelectedIndex < filteredAndSorted.length) {
          const repo = filteredAndSorted[kbSelectedIndex];
          // Toggle selection (same as clicking the checkbox)
          const toggleRepoSelection = useScoutStore.getState().toggleRepoSelection;
          toggleRepoSelection(repo.repo_url);
        }
      },
      e: () => {
        // Trigger the export dropdown button click
        const exportBtn = document.querySelector<HTMLButtonElement>(
          '[data-export-trigger="true"]'
        );
        if (exportBtn) {
          exportBtn.click();
        }
      },
    },
    [kbSelectedIndex, filteredAndSorted]
  );

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Filter repositories">
        {/* Language dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-1.5 text-xs",
                languageFilter && "border-teal/40 text-teal"
              )}
              aria-label={languageFilter ? `Filtering by ${languageFilter}` : "Filter by language"}
            >
              <Filter className="size-3" aria-hidden="true" />
              {languageFilter ?? "Language"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setLanguageFilter(null)}>
              All languages
            </DropdownMenuItem>
            {languages.map((lang) => (
              <DropdownMenuItem
                key={lang}
                onClick={() => setLanguageFilter(lang)}
              >
                {lang}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tier pills */}
        {([1, 2, 3] as QualityTier[]).map((tier) => (
          <Button
            key={tier}
            variant={tierFilter === tier ? "default" : "outline"}
            size="xs"
            className={cn(
              "text-xs",
              tierFilter === tier &&
              "bg-teal text-white hover:bg-teal/90"
            )}
            onClick={() =>
              setTierFilter(tierFilter === tier ? null : tier)
            }
            aria-label={`Filter by Tier ${tier}`}
            aria-pressed={tierFilter === tier}
          >
            {"\u2605".repeat(4 - tier)} Tier {tier}
          </Button>
        ))}

        {/* Verified toggle */}
        <Button
          variant={verifiedOnly ? "default" : "outline"}
          size="xs"
          className={cn(
            "text-xs",
            verifiedOnly && "bg-teal text-white hover:bg-teal/90"
          )}
          onClick={() => setVerifiedOnly(!verifiedOnly)}
          aria-label="Show verified repositories only"
          aria-pressed={verifiedOnly}
        >
          Verified only
        </Button>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="xs"
            className="gap-1 text-xs text-muted-foreground"
            onClick={clearAllFilters}
            aria-label="Clear all filters"
          >
            <X className="size-3" aria-hidden="true" />
            Clear
          </Button>
        )}

        {hasActiveFilters && (
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {filteredAndSorted.length} of {repos.length} repos
          </span>
        )}
      </div>

      {/* Desktop table — hidden on mobile */}
      <div ref={tableRef} className="hidden md:block rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 pr-0" />
              <TableHead className="text-sm font-semibold text-foreground">Repository</TableHead>
              <SortableHead label="Stars" sortKeyName="stars" className="text-sm font-semibold" />
              <SortableHead label="Last Active" sortKeyName="last_commit" className="text-sm font-semibold" />
              <TableHead className="text-sm font-semibold text-foreground">Language</TableHead>
              <SortableHead
                label="Quality"
                sortKeyName="quality_tier"
                className="text-sm font-semibold"
              />
              <TableHead className="text-sm font-semibold text-foreground">
                Verification
              </TableHead>
              <TableHead className="text-sm font-semibold text-foreground">Reddit</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.map((repo, idx) => (
              <RepoRow key={repo.repo_url} repo={repo} index={idx} isKeyboardSelected={idx === kbSelectedIndex} />
            ))}

            {/* Skeleton rows during loading */}
            {isSearching &&
              !phase1Complete &&
              repos.length === 0 &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`}>
                  <td colSpan={9}>
                    <RepoRowSkeleton />
                  </td>
                </tr>
              ))}
          </TableBody>
        </Table>

        {/* Empty state */}
        {!isSearching && repos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-serif text-lg text-muted-foreground">
              No repositories found
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Try adjusting your search query or filters
            </p>
          </div>
        )}

        {/* Filtered empty state */}
        {repos.length > 0 && filteredAndSorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No repos match current filters
            </p>
            <Button
              variant="link"
              size="sm"
              className="mt-1 text-teal"
              onClick={clearAllFilters}
            >
              Clear all filters
            </Button>
          </div>
        )}
      </div>

      {/* Mobile card layout — shown only on mobile */}
      <div className="md:hidden space-y-3">
        {filteredAndSorted.map((repo) => (
          <MobileRepoCard key={repo.repo_url} repo={repo} />
        ))}

        {/* Skeleton cards during loading */}
        {isSearching &&
          !phase1Complete &&
          repos.length === 0 &&
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`skel-mobile-${i}`}
              className="animate-shimmer rounded-lg border border-border/60 bg-card p-4 h-32"
            />
          ))}

        {/* Empty state */}
        {!isSearching && repos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-serif text-lg text-muted-foreground">
              No repositories found
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Try adjusting your search query or filters
            </p>
          </div>
        )}

        {/* Filtered empty state */}
        {repos.length > 0 && filteredAndSorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No repos match current filters
            </p>
            <Button
              variant="link"
              size="sm"
              className="mt-1 text-teal"
              onClick={clearAllFilters}
            >
              Clear all filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile card view for individual repos                               */
/* ------------------------------------------------------------------ */
function MobileRepoCard({ repo }: { repo: RepoResult }) {
  const toggleRepoSelection = useScoutStore((s) => s.toggleRepoSelection);
  const selectedRepoUrls = useScoutStore((s) => s.selectedRepoUrls);

  const isSelected = selectedRepoUrls.includes(repo.repo_url);
  const isMaxSelected = selectedRepoUrls.length >= 5 && !isSelected;

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-card p-4 space-y-3 animate-slide-up",
        isSelected && "border-teal/40 bg-teal/[0.03]"
      )}
    >
      {/* Top row: checkbox + repo name */}
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          disabled={isMaxSelected}
          onCheckedChange={() => toggleRepoSelection(repo.repo_url)}
          aria-label={`Select ${repo.repo_name} for deep dive`}
          className="mt-1 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <a
            href={repo.repo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-sm font-medium text-foreground hover:text-teal transition-colors"
          >
            <span className="truncate">{repo.repo_name}</span>
            <ExternalLink className="size-3 shrink-0 opacity-40" aria-hidden="true" />
          </a>
          {repo.summary && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {repo.summary}
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {repo.stars !== null && (
          <div className="flex items-center gap-1">
            <Star className="size-3 fill-amber text-amber" aria-hidden="true" />
            <span>{formatStarCount(repo.stars)}</span>
          </div>
        )}
        {repo.last_commit && (
          <span>{formatRelativeDate(repo.last_commit)}</span>
        )}
        {repo.primary_language && (
          <span>{repo.primary_language}</span>
        )}
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2">
        <QualityTierBadge tier={repo.quality_tier} />
        <VerificationBadge verification={repo.verification} />
      </div>
    </div>
  );
}
