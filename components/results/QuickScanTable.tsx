"use client";

import { useState, useMemo, useCallback } from "react";
import { ArrowUpDown, Filter, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RepoRow } from "./RepoRow";
import { RepoRowSkeleton } from "@/components/shared/LoadingSkeleton";
import { useScoutStore } from "@/stores/scout-store";
import { getOverallVerificationStatus } from "@/lib/verification";
import type { QualityTier, RepoResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = "stars" | "last_commit" | "quality_tier";
type SortDir = "asc" | "desc";

export function QuickScanTable() {
  const repos = useScoutStore((s) => s.repos);
  const isSearching = useScoutStore((s) => s.isSearching);
  const phase1Complete = useScoutStore((s) => s.phase1Complete);

  const [sortKey, setSortKey] = useState<SortKey>("stars");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<QualityTier | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

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
      >
        {label}
        <ArrowUpDown
          className={cn(
            "size-3",
            sortKey === sortKeyName
              ? "text-teal"
              : "text-muted-foreground/50"
          )}
        />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
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
            >
              <Filter className="size-3" />
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
        >
          Verified only
        </Button>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="xs"
            className="gap-1 text-xs text-muted-foreground"
            onClick={() => {
              setLanguageFilter(null);
              setTierFilter(null);
              setVerifiedOnly(false);
            }}
          >
            <X className="size-3" />
            Clear
          </Button>
        )}

        {hasActiveFilters && (
          <span className="text-xs text-muted-foreground">
            {filteredAndSorted.length} of {repos.length} repos
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/60 bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10" />
              <TableHead className="text-xs font-medium">Repository</TableHead>
              <SortableHead label="Stars" sortKeyName="stars" />
              <SortableHead label="Last Active" sortKeyName="last_commit" />
              <TableHead className="text-xs font-medium">Language</TableHead>
              <SortableHead
                label="Quality"
                sortKeyName="quality_tier"
              />
              <TableHead className="text-xs font-medium">
                Verification
              </TableHead>
              <TableHead className="text-xs font-medium">Reddit</TableHead>
              <TableHead className="text-xs font-medium">Summary</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.map((repo, idx) => (
              <RepoRow key={repo.repo_url} repo={repo} index={idx} />
            ))}

            {/* Skeleton rows during loading */}
            {isSearching &&
              !phase1Complete &&
              repos.length === 0 &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`}>
                  <td colSpan={10}>
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
              onClick={() => {
                setLanguageFilter(null);
                setTierFilter(null);
                setVerifiedOnly(false);
              }}
            >
              Clear all filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
