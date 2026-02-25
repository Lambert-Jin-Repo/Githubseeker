"use client";

import { useState, useCallback, useEffect } from "react";
import { Search, ArrowRight, Loader2 } from "lucide-react";

interface SearchInputProps {
  onSubmit: (query: string) => void;
  isLoading?: boolean;
  defaultValue?: string;
}

export function SearchInput({ onSubmit, isLoading, defaultValue = "" }: SearchInputProps) {
  const [query, setQuery] = useState(defaultValue);

  // Sync internal state when defaultValue changes externally (e.g. example click)
  useEffect(() => {
    setQuery(defaultValue);
  }, [defaultValue]);

  const handleSubmit = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed.length >= 3 && !isLoading) {
      onSubmit(trimmed);
    }
  }, [query, isLoading, onSubmit]);

  return (
    <div className="relative w-full max-w-2xl">
      <div className="group relative flex items-center rounded-2xl border border-border/80 bg-card shadow-sm transition-all duration-300 focus-within:border-teal/40 focus-within:shadow-[0_0_0_3px_rgba(15,118,110,0.08)] hover:border-border">
        <Search className="ml-5 h-5 w-5 shrink-0 text-muted-foreground/60" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="What do you want to discover?"
          maxLength={200}
          disabled={isLoading}
          className="flex-1 bg-transparent px-4 py-4.5 text-base font-sans text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
          autoFocus
        />
        {query.length > 150 && (
          <span className="mr-2 text-xs tabular-nums text-muted-foreground/60">
            {query.length}/200
          </span>
        )}
        <button
          onClick={handleSubmit}
          disabled={query.trim().length < 3 || isLoading}
          className="mr-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-teal text-teal-foreground transition-all duration-200 hover:bg-teal/90 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
        </button>
      </div>
      {query.trim().length > 0 && query.trim().length < 3 && (
        <p className="mt-2 text-xs text-muted-foreground/70 pl-5">
          Enter at least 3 characters to search
        </p>
      )}
    </div>
  );
}
