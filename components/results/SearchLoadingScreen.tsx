"use client";

import { useEffect, useState, useMemo } from "react";
import { Check, AlertCircle, Search, BookOpen, Hammer } from "lucide-react";
import { useScoutStore } from "@/stores/scout-store";
import { cn } from "@/lib/utils";

const STRATEGY_META: Record<string, { label: string; angle: number }> = {
  high_star: { label: "Popular Repos", angle: 0 },
  awesome_list: { label: "Curated Lists", angle: 51 },
  topic_page: { label: "Topic Pages", angle: 103 },
  editorial: { label: "Expert Roundups", angle: 154 },
  architecture: { label: "Architecture", angle: 206 },
  competitive: { label: "Alternatives", angle: 257 },
  ai_patterns: { label: "AI Skills", angle: 309 },
};

function getStrategyAngle(strategy: string, index: number): number {
  return STRATEGY_META[strategy]?.angle ?? index * 51;
}

function getStrategyLabel(strategy: string): string {
  return STRATEGY_META[strategy]?.label ?? strategy;
}

const MODE_ICONS = {
  SCOUT: Search,
  LEARN: BookOpen,
  BUILD: Hammer,
} as const;

// Floating background particles
function Particles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        left: `${10 + Math.random() * 80}%`,
        top: `${10 + Math.random() * 80}%`,
        delay: `${Math.random() * 6}s`,
        duration: `${4 + Math.random() * 4}s`,
        size: 2 + Math.random() * 3,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-teal/30 animate-float-particle"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

interface SearchLoadingScreenProps {
  isContracting: boolean;
}

export function SearchLoadingScreen({ isContracting }: SearchLoadingScreenProps) {
  const searchProgress = useScoutStore((s) => s.searchProgress);
  const repos = useScoutStore((s) => s.repos);
  const searchMeta = useScoutStore((s) => s.searchMeta);
  const mode = useScoutStore((s) => s.mode);

  const [displayedRepoCount, setDisplayedRepoCount] = useState(0);

  // Animate the repo counter
  useEffect(() => {
    const target = repos.length;
    if (target === displayedRepoCount) return;
    const timer = setTimeout(
      () => setDisplayedRepoCount((c) => (c < target ? c + 1 : c)),
      80
    );
    return () => clearTimeout(timer);
  }, [repos.length, displayedRepoCount]);

  const completedCount = searchProgress.filter((p) => p.status === "complete").length;
  const totalCount = searchProgress.length;
  const ModeIcon = MODE_ICONS[(mode as keyof typeof MODE_ICONS) || "SCOUT"] || Search;

  const RADIUS = 120; // orbit radius in px

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center px-4 py-16 min-h-[60vh] transition-all duration-300",
        isContracting && "animate-contract"
      )}
      role="status"
      aria-live="polite"
      aria-label="Searching for repositories"
    >
      <Particles />

      {/* Glow behind radar */}
      <div
        className="absolute rounded-full bg-teal/20 animate-glow-breathe"
        style={{ width: RADIUS * 2.8, height: RADIUS * 2.8 }}
        aria-hidden="true"
      />

      {/* Radar container */}
      <div className="relative" style={{ width: RADIUS * 2.6, height: RADIUS * 2.6 }}>

        {/* Outer orbit ring — dashed, slowly rotating */}
        <svg
          className="absolute inset-0 animate-radar-spin"
          viewBox="0 0 312 312"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="156"
            cy="156"
            r="140"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="8 6"
            className="text-teal/25"
          />
        </svg>

        {/* Inner ring — solid, subtle */}
        <svg
          className="absolute inset-0"
          viewBox="0 0 312 312"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="156"
            cy="156"
            r="90"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-teal/15"
          />
        </svg>

        {/* Ping ring — expanding pulse */}
        <svg
          className="absolute inset-0 animate-radar-ping"
          viewBox="0 0 312 312"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="156"
            cy="156"
            r="140"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-teal/20"
          />
        </svg>

        {/* Scan sweep line */}
        <svg
          className="absolute inset-0 animate-scan-sweep"
          viewBox="0 0 312 312"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="sweep-grad" x1="156" y1="156" x2="156" y2="16" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0F766E" stopOpacity="0" />
              <stop offset="100%" stopColor="#0F766E" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <line x1="156" y1="156" x2="156" y2="16" stroke="url(#sweep-grad)" strokeWidth="2" strokeLinecap="round" />
        </svg>

        {/* Center icon + mode label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="flex items-center justify-center size-16 rounded-full bg-card border border-teal/20 shadow-sm">
            <ModeIcon className="size-7 text-teal" strokeWidth={1.5} />
          </div>
          <span className="mt-2.5 text-xs font-medium uppercase tracking-widest text-teal/70">
            {mode || "SCOUT"}
          </span>
        </div>

        {/* Strategy nodes positioned around the orbit */}
        {searchProgress.map((progress, index) => {
          const angleDeg = getStrategyAngle(progress.strategy, index);
          const angleRad = (angleDeg - 90) * (Math.PI / 180);
          const orbitR = RADIUS * 0.9;
          const cx = RADIUS * 1.3 + Math.cos(angleRad) * orbitR;
          const cy = RADIUS * 1.3 + Math.sin(angleRad) * orbitR;

          const isRunning = progress.status === "running";
          const isComplete = progress.status === "complete";
          const isFailed = progress.status === "failed";

          return (
            <div
              key={progress.strategy}
              className={cn(
                "absolute flex items-center gap-1.5 animate-node-arrive",
                `delay-${Math.min(index + 1, 8)}`
              )}
              style={{
                left: cx,
                top: cy,
                transform: "translate(-50%, -50%)",
              }}
            >
              {/* Dot */}
              <div
                className={cn(
                  "size-3 rounded-full border-2 transition-all duration-500 shrink-0",
                  isComplete && "bg-success border-success scale-110",
                  isFailed && "bg-destructive border-destructive scale-110",
                  isRunning && "border-teal bg-teal/30 animate-pulse-soft",
                  !isComplete && !isFailed && !isRunning && "border-border bg-secondary"
                )}
              >
                {isComplete && (
                  <Check className="size-2 text-white mx-auto mt-px" strokeWidth={3} />
                )}
                {isFailed && (
                  <AlertCircle className="size-2 text-white mx-auto mt-px" strokeWidth={3} />
                )}
              </div>
              {/* Label */}
              <span
                className={cn(
                  "text-[10px] font-medium whitespace-nowrap transition-colors duration-300",
                  isComplete && "text-success",
                  isFailed && "text-destructive",
                  isRunning && "text-teal",
                  !isComplete && !isFailed && !isRunning && "text-muted-foreground/50"
                )}
              >
                {getStrategyLabel(progress.strategy)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Query text */}
      <div className="mt-8 text-center animate-slide-up">
        <p className="font-serif text-xl text-foreground/90 max-w-md truncate">
          {searchMeta?.query || "Searching..."}
        </p>
      </div>

      {/* Live counter */}
      <div className="mt-5 flex flex-col items-center gap-2 animate-slide-up delay-2">
        {displayedRepoCount > 0 ? (
          <p className="text-sm text-muted-foreground animate-counter-tick" key={displayedRepoCount}>
            Discovered{" "}
            <span className="font-semibold text-teal tabular-nums">{displayedRepoCount}</span>
            {" "}repositor{displayedRepoCount === 1 ? "y" : "ies"} so far
          </p>
        ) : (
          <p className="text-sm text-muted-foreground animate-pulse-soft">
            Scanning the web...
          </p>
        )}

        {totalCount > 0 && (
          <p className="text-xs text-muted-foreground/60">
            {completedCount}/{totalCount} strategies complete
          </p>
        )}
      </div>
    </div>
  );
}
