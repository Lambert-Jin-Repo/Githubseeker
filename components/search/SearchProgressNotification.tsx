"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSearchNotificationStore } from "@/stores/search-notification-store";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STRATEGY_LABELS: Record<string, string> = {
    high_star: "Searching popular repositories",
    awesome_list: "Scanning curated awesome lists",
    editorial: "Checking expert roundups",
    architecture: "Exploring architecture patterns",
    competitive: "Finding alternatives",
    general: "Searching the web",
};

const PHASE_MESSAGES = [
    "Setting up AI search agent...",
    "Scanning the open-source landscape...",
    "Analyzing repository metadata...",
    "Verifying top candidates...",
    "Compiling results...",
];

export function SearchProgressNotification() {
    const router = useRouter();
    const status = useSearchNotificationStore((s) => s.status);
    const searchId = useSearchNotificationStore((s) => s.searchId);
    const query = useSearchNotificationStore((s) => s.query);
    const strategiesComplete = useSearchNotificationStore((s) => s.strategiesComplete);
    const strategiesTotal = useSearchNotificationStore((s) => s.strategiesTotal);
    const reposFound = useSearchNotificationStore((s) => s.reposFound);
    const currentStrategy = useSearchNotificationStore((s) => s.currentStrategy);
    const error = useSearchNotificationStore((s) => s.error);
    const startedAt = useSearchNotificationStore((s) => s.startedAt);

    const [elapsed, setElapsed] = useState(0);
    const [phaseIndex, setPhaseIndex] = useState(0);

    // Elapsed timer
    useEffect(() => {
        if (!startedAt || status === "complete" || status === "idle") return;
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startedAt) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [startedAt, status]);

    // Cycle through phase messages when no strategy is active
    useEffect(() => {
        if (status !== "connecting" && status !== "searching") return;
        if (currentStrategy) return; // Real strategy messages take priority
        const interval = setInterval(() => {
            setPhaseIndex((i) => (i + 1) % PHASE_MESSAGES.length);
        }, 4000);
        return () => clearInterval(interval);
    }, [status, currentStrategy]);

    if (status === "idle") return null;

    const handleViewResults = () => {
        if (searchId) {
            router.push(`/scout/${searchId}`);
        }
    };

    const progressPercent =
        strategiesTotal > 0
            ? Math.round((strategiesComplete / strategiesTotal) * 100)
            : 0;

    const strategyMessage = currentStrategy
        ? STRATEGY_LABELS[currentStrategy] || `Searching ${currentStrategy}`
        : PHASE_MESSAGES[phaseIndex];

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    return (
        <div
            className={cn(
                "w-full max-w-2xl mx-auto mt-6 animate-slide-up",
                status === "complete" && "animate-badge-pop"
            )}
        >
            <div
                className={cn(
                    "relative overflow-hidden rounded-2xl border backdrop-blur-sm transition-all duration-500",
                    (status === "connecting" || status === "searching") &&
                    "border-teal/20 bg-gradient-to-br from-teal/[0.03] to-teal/[0.08]",
                    status === "complete" &&
                    "border-success/25 bg-gradient-to-br from-success/[0.03] to-success/[0.08]",
                    status === "error" &&
                    "border-destructive/25 bg-gradient-to-br from-destructive/[0.03] to-destructive/[0.08]"
                )}
            >
                {/* Progress bar */}
                {(status === "searching" || status === "connecting") && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-teal/10">
                        <div
                            className="h-full bg-teal/50 transition-all duration-700 ease-out"
                            style={{ width: `${Math.max(progressPercent, 5)}%` }}
                        />
                    </div>
                )}

                <div className="px-5 py-4 space-y-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            {(status === "connecting" || status === "searching") && (
                                <div className="flex items-center justify-center size-8 rounded-full bg-teal/10 shrink-0">
                                    <Sparkles className="size-4 text-teal animate-pulse-soft" />
                                </div>
                            )}
                            {status === "complete" && (
                                <div className="flex items-center justify-center size-8 rounded-full bg-success/10 shrink-0">
                                    <CheckCircle2 className="size-4 text-success" />
                                </div>
                            )}
                            {status === "error" && (
                                <div className="flex items-center justify-center size-8 rounded-full bg-destructive/10 shrink-0">
                                    <AlertCircle className="size-4 text-destructive" />
                                </div>
                            )}

                            <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                    {status === "complete"
                                        ? "Search complete!"
                                        : status === "error"
                                            ? "Search failed"
                                            : `Searching for "${query}"`}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    {(status === "connecting" || status === "searching") &&
                                        strategyMessage}
                                    {status === "complete" &&
                                        `Found ${reposFound} repositories across ${strategiesComplete} strategies`}
                                    {status === "error" && (error || "Something went wrong")}
                                </p>
                            </div>
                        </div>

                        {/* Timer */}
                        {(status === "connecting" || status === "searching") && elapsed > 0 && (
                            <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/60 tabular-nums shrink-0">
                                <Clock className="size-3" />
                                {formatTime(elapsed)}
                            </div>
                        )}
                    </div>

                    {/* Stats row */}
                    {(status === "searching" || status === "complete") && (
                        <div className="flex items-center gap-4 text-xs">
                            {strategiesTotal > 0 && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Loader2
                                        className={cn(
                                            "size-3",
                                            status === "searching" && "animate-spin",
                                            status === "complete" && "hidden"
                                        )}
                                    />
                                    {status === "complete" ? (
                                        <CheckCircle2 className="size-3 text-success" />
                                    ) : null}
                                    <span>
                                        {strategiesComplete}/{strategiesTotal} strategies
                                    </span>
                                </div>
                            )}
                            {reposFound > 0 && (
                                <div className="text-muted-foreground">
                                    <span className="font-semibold text-teal tabular-nums">
                                        {reposFound}
                                    </span>{" "}
                                    repos discovered
                                </div>
                            )}
                        </div>
                    )}

                    {/* Helper text */}
                    {(status === "connecting" || status === "searching") && elapsed < 10 && (
                        <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
                            This typically takes 30–60 seconds. You can navigate away — we&apos;ll keep searching in the background.
                        </p>
                    )}

                    {/* Action buttons */}
                    {status === "complete" && (
                        <button
                            onClick={handleViewResults}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-success text-white px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-success/90 hover:shadow-md active:scale-[0.98]"
                        >
                            View Results
                            <ArrowRight className="size-4" />
                        </button>
                    )}

                    {status === "error" && (
                        <p className="text-xs text-muted-foreground">
                            Please try searching again.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
