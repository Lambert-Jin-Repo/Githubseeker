"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Hammer, Compass, Search, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ErrorBoundaryCard } from "@/components/shared/ErrorBoundaryCard";
import { cn } from "@/lib/utils";
import type { SearchHistoryItem, ScoutMode } from "@/lib/types";

const MODE_CONFIG: Record<
  ScoutMode,
  { icon: typeof BookOpen; label: string; color: string }
> = {
  LEARN: {
    icon: BookOpen,
    label: "Learn",
    color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20",
  },
  BUILD: {
    icon: Hammer,
    label: "Build",
    color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20",
  },
  SCOUT: {
    icon: Compass,
    label: "Scout",
    color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20",
  },
};

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function HistoryList() {
  const router = useRouter();
  const [items, setItems] = useState<SearchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/history");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg bg-secondary/50"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorBoundaryCard
        title="Failed to load history"
        message="We couldn't fetch your search history. Please try again."
        onRetry={fetchHistory}
      />
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-teal/10">
          <Search className="size-6 text-teal" />
        </div>
        <div>
          <h3 className="font-serif text-lg font-semibold text-foreground">
            No searches yet
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Run your first search to start building your history.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-medium text-teal-foreground transition-colors hover:bg-teal/90"
        >
          Start Searching
          <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const config = MODE_CONFIG[item.mode];
        const Icon = config.icon;

        const delayClass =
          index < 12
            ? `delay-${Math.min(index + 1, 8)}`
            : undefined;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => router.push(`/scout/${item.id}`)}
            className={cn(
              "animate-slide-up w-full rounded-lg border border-border/60 bg-card p-4 text-left transition-all",
              "hover:border-teal/30 hover:bg-teal/[0.02] hover:shadow-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40",
              delayClass
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.query}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-1 border px-2 py-0.5 text-[11px]",
                      config.color
                    )}
                  >
                    <Icon className="size-3" />
                    {config.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {item.repos_found} repo{item.repos_found !== 1 ? "s" : ""}{" "}
                    found
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground/70">
                {formatRelativeDate(item.created_at)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
