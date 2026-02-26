"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface DeepDiveHeaderProps {
  searchId: string;
  query?: string;
  repoCount: number;
}

export function DeepDiveHeader({
  searchId,
  query,
  repoCount,
}: DeepDiveHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push(`/scout/${searchId}`)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Back to search results"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Back to Results</span>
          </button>

          <div className="flex-1 text-center">
            <h1 className="font-serif text-xl font-semibold text-foreground sm:text-2xl">
              Deep Dive Report
            </h1>
            {query && (
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                {query}
                {repoCount > 0 && (
                  <span className="ml-1.5">
                    &middot; {repoCount}{" "}
                    {repoCount === 1 ? "repository" : "repositories"}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Spacer to balance the back button for centering */}
          <div className="w-[120px] hidden sm:block" aria-hidden="true" />
        </div>
      </div>
    </header>
  );
}
