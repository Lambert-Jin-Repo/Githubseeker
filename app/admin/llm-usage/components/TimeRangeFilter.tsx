"use client";

type Range = "today" | "7d" | "30d";

interface TimeRangeFilterProps {
  range: Range;
  onRangeChange: (range: Range) => void;
  autoRefresh: boolean;
  onAutoRefreshChange: (enabled: boolean) => void;
}

const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
];

export function TimeRangeFilter({
  range,
  onRangeChange,
  autoRefresh,
  onAutoRefreshChange,
}: TimeRangeFilterProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Range pills */}
      <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => onRangeChange(r.value)}
            className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              range === r.value
                ? "bg-teal text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Auto-refresh toggle */}
      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={autoRefresh}
          onChange={(e) => onAutoRefreshChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 ${
            autoRefresh ? "bg-teal" : "bg-border"
          }`}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              autoRefresh ? "translate-x-3.5" : "translate-x-0"
            }`}
          />
        </div>
        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
          Auto-refresh
          {autoRefresh && (
            <svg
              className="w-3.5 h-3.5 text-teal animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
        </span>
      </label>
    </div>
  );
}
