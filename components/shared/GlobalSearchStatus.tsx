"use client";

import { useSearchNotificationStore } from "@/stores/search-notification-store";
import { useRouter } from "next/navigation";
import { X, Loader2, CheckCircle2, AlertCircle, ArrowRight, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

    const isActive = status === "connecting" || status === "searching";

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={cn(
                    "group relative flex items-center gap-2.5 rounded-full border px-3.5 py-2 text-sm font-medium cursor-default",
                    "shadow-sm hover:shadow-md transition-shadow duration-300",
                    isActive && "border-teal/40 bg-teal/8 dark:bg-teal/15 text-teal dark:text-teal",
                    status === "complete" && "border-success/40 bg-success/8 dark:bg-success/15 text-success",
                    status === "error" && "border-destructive/40 bg-destructive/8 dark:bg-destructive/15 text-destructive"
                )}
                role="status"
                aria-live="polite"
            >
                {/* Glow effect behind the pill */}
                {isActive && (
                    <div className="absolute inset-0 rounded-full bg-teal/5 dark:bg-teal/10 blur-md animate-pulse-soft -z-10" />
                )}

                {/* Status icon */}
                {isActive && (
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    >
                        <Loader2 className="size-3.5 shrink-0" aria-hidden="true" />
                    </motion.div>
                )}
                {status === "complete" && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    >
                        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
                    </motion.div>
                )}
                {status === "error" && (
                    <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                )}

                {/* Status text */}
                <AnimatePresence mode="wait">
                    <motion.span
                        key={`${status}-${strategyLabel}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="max-w-[200px] truncate"
                    >
                        {status === "connecting" && "Connecting..."}
                        {status === "searching" && (
                            <>
                                {strategyLabel ? (
                                    <span>{strategyLabel}</span>
                                ) : (
                                    <span>Searching</span>
                                )}
                                {strategiesTotal > 0 && (
                                    <span className="ml-1.5 opacity-60 font-mono text-xs tabular-nums">
                                        {strategiesComplete}/{strategiesTotal}
                                    </span>
                                )}
                                {reposFound > 0 && (
                                    <span className="ml-1 opacity-60 text-xs">
                                        · {reposFound} found
                                    </span>
                                )}
                            </>
                        )}
                        {status === "complete" && (
                            <span className="flex items-center gap-1">
                                <Zap className="size-3" />
                                {reposFound} repos ready
                            </span>
                        )}
                        {status === "error" && (
                            <span title={error || undefined}>Search failed</span>
                        )}
                    </motion.span>
                </AnimatePresence>

                {/* View Results button */}
                {status === "complete" && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.15, type: "spring", stiffness: 400 }}
                        onClick={handleViewResults}
                        className="inline-flex items-center gap-1 rounded-full bg-success/15 dark:bg-success/25 px-2.5 py-0.5 text-xs font-semibold text-success transition-all duration-200 hover:bg-success/25 dark:hover:bg-success/35 hover:scale-105 active:scale-95"
                        aria-label={`View results for "${query}"`}
                    >
                        View
                        <ArrowRight className="size-3" />
                    </motion.button>
                )}

                {/* Dismiss */}
                <button
                    onClick={dismiss}
                    className="ml-0.5 rounded-full p-1 transition-all duration-200 hover:bg-foreground/10 hover:scale-110 active:scale-90 opacity-40 hover:opacity-80"
                    aria-label="Dismiss search notification"
                >
                    <X className="size-3" />
                </button>
            </motion.div>
        </AnimatePresence>
    );
}
