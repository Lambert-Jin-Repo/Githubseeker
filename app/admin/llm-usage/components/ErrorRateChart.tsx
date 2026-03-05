"use client";

const PROVIDER_COLORS: Record<string, string> = {
  minimax: "#0F766E",
  serper: "#F59E0B",
  github: "#6366F1",
};

interface ErrorEntry {
  time: string;
  provider: string;
  operation: string;
  error_type: string;
}

interface ErrorRateChartProps {
  errors: ErrorEntry[];
}

function formatTime(time: string): string {
  const date = new Date(time);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatOperation(op: string): string {
  return op
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ErrorRateChart({ errors }: ErrorRateChartProps) {
  return (
    <div className="rounded-xl bg-card border border-border shadow-sm p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4 font-serif">
        Recent Errors
      </h3>

      {errors.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-sm text-muted-foreground">
          <svg
            className="w-8 h-8 text-success/50 mb-2"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          No errors in this period
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {errors.map((err, i) => (
            <div
              key={`${err.time}-${i}`}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-background border border-border/50"
            >
              {/* Provider dot */}
              <div
                className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                style={{
                  backgroundColor:
                    PROVIDER_COLORS[err.provider] || "#64748B",
                }}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-foreground capitalize">
                    {err.provider}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatOperation(err.operation)}
                  </span>
                </div>
                <div className="text-xs text-destructive mt-0.5 font-mono">
                  {err.error_type || "Unknown error"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatTime(err.time)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
