import { AlertTriangle, TrendingUp } from "lucide-react";

interface EcosystemGapsProps {
  gaps: Array<{ gap: string; opportunity: string }>;
}

export function EcosystemGaps({ gaps }: EcosystemGapsProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-card px-4 py-5 sm:p-6 space-y-4 sm:space-y-5">
      <h2 className="font-serif text-lg sm:text-xl text-foreground">
        Ecosystem Gaps &amp; Opportunities
      </h2>

      {gaps.length === 0 ? (
        <p className="text-sm text-muted-foreground/60">
          No significant gaps identified in the analyzed ecosystem.
        </p>
      ) : (
        <div className="space-y-4">
          {gaps.map((item, idx) => (
            <div
              key={idx}
              className="border-l-4 border-amber-400 pl-4 py-2"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
                <p className="font-medium text-foreground text-sm">
                  {item.gap}
                </p>
              </div>
              <div className="flex items-start gap-2 mt-1 ml-6">
                <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-teal" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  {item.opportunity}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
