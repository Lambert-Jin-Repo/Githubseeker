"use client";

import { useSearchNotificationStore } from "@/stores/search-notification-store";
import { useRouter } from "next/navigation";
import { X, Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STRATEGY_LABELS: Record<string, string> = {
    high_star: "Popular repos",
    awesome_list: "Curated lists",
    editorial: "Expert roundups",
    architecture: "Architecture",
    competitive: "Alternatives",
    general: "Web search",
};

export function GlobalSearchStatus() {
    const router = useRouter();
    const status = useSearchNotificationStore((s) => s.status);
    const searchId = useSearchNotificationStore((s) => s.searchId);
    const query = useSearchNotificationStore((s) => s.query);
    const strategiesComplete = useSearchNotificationStore((s) => s.strategiesComplete);
    const strategiesTotal = useSearchNotificationStore((s) => s.strategiesTotal);
    const reposFound = useSearchNotificationStore((s) => s.reposFound);
    const currentStrategy = useSearchNotificationStore((s) => s.currentStrategy);
    const error = useSearchNotificationStore((s) => s.error);
    const dismiss = useSearchNotificationStore((s) => s.dismiss);

    if (status === "idle") return null;

    const handleViewResults = () => {
        if (searchId) {
            router.push(`/scout/${searchId}`);
        }
    };

    const strategyLabel = currentStrategy
        ? STRATEGY_LABELS[currentStrategy] || currentStrategy
        : null;

    return (
        <div
            className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium animate-status-enter transition-all duration-300",
                status === "connecting" && "border-teal/30 bg-teal/5 text-teal",
                status === "searching" && "border-teal/30 bg-teal/5 text-teal",
                status === "complete" && "border-success/30 bg-success/5 text-success",
                status === "error" && "border-destructive/30 bg-destructive/5 text-destructive"
            )}
            role="status"
            aria-live="polite"
        >
            {/* Status icon */}
            {(status === "connecting" || status === "searching") && (
                <Loader2 className="size-3 animate-spin shrink-0" aria-hidden="true" />
            )}
            {status === "complete" && (
                <CheckCircle2 className="size-3 shrink-0" aria-hidden="true" />
            )}
            {status === "error" && (
                <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
            )}

            {/* Status text */}
            <span className="max-w-[180px] truncate">
                {status === "connecting" && "Connecting..."}
                {status === "searching" && (
                    <>
                        {strategyLabel ? (
                            <span>Scanning {strategyLabel.toLowerCase()}</span>
                        ) : (
                            <span>Searching</span>
                        )}
                        {strategiesTotal > 0 && (
                            <span className="ml-1 opacity-70">
                                {strategiesComplete}/{strategiesTotal}
                            </span>
                        )}
                        {reposFound > 0 && (
                            <span className="ml-1 opacity-70">
                                · {reposFound} found
                            </span>
                        )}
                    </>
                )}
                {status === "complete" && (
                    <span>
                        {reposFound} repos ready
                    </span>
                )}
                {status === "error" && (
                    <span title={error || undefined}>
                        Search failed
                    </span>
                )}
            </span>

            {/* View Results button */}
            {status === "complete" && (
                <button
                    onClick={handleViewResults}
                    className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success transition-colors hover:bg-success/20"
                    aria-label={`View results for "${query}"`}
                >
                    View
                    <ArrowRight className="size-2.5" />
                </button>
            )}

            {/* Dismiss */}
            <button
                onClick={dismiss}
                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-black/5"
                aria-label="Dismiss search notification"
            >
                <X className="size-3 opacity-50" />
            </button>
        </div>
    );
}
