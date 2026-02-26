"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSearchNotificationStore } from "@/stores/search-notification-store";
import {
    Loader2,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    Clock,
    Sparkles,
    GitFork,
    Search,
    Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const STRATEGY_LABELS: Record<string, { label: string; icon: typeof Search }> = {
    high_star: { label: "Searching popular repositories", icon: Sparkles },
    awesome_list: { label: "Scanning curated awesome lists", icon: GitFork },
    editorial: { label: "Checking expert roundups", icon: Search },
    architecture: { label: "Exploring architecture patterns", icon: Search },
    competitive: { label: "Finding alternatives", icon: Search },
    general: { label: "Searching the web", icon: Search },
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

    useEffect(() => {
        if (!startedAt || status === "complete" || status === "idle") return;
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startedAt) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [startedAt, status]);

    useEffect(() => {
        if (status !== "connecting" && status !== "searching") return;
        if (currentStrategy) return;
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

    const strategyInfo = currentStrategy
        ? STRATEGY_LABELS[currentStrategy] || { label: `Searching ${currentStrategy}`, icon: Search }
        : null;
    const strategyMessage = strategyInfo ? strategyInfo.label : PHASE_MESSAGES[phaseIndex];

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    const isActive = status === "connecting" || status === "searching";

    return (
        <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="w-full max-w-2xl mx-auto mt-6"
        >
            <div
                className={cn(
                    "relative overflow-hidden rounded-2xl border backdrop-blur-md shadow-lg dark:shadow-2xl transition-all duration-500",
                    isActive &&
                    "border-teal/25 dark:border-teal/40 bg-gradient-to-br from-card via-card to-teal/5 dark:to-teal/10",
                    status === "complete" &&
                    "border-success/30 dark:border-success/40 bg-gradient-to-br from-card via-card to-success/5 dark:to-success/10",
                    status === "error" &&
                    "border-destructive/30 dark:border-destructive/40 bg-gradient-to-br from-card via-card to-destructive/5 dark:to-destructive/10"
                )}
            >
                {/* Animated progress bar */}
                {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-teal/10 dark:bg-teal/20">
                        <motion.div
                            className="h-full bg-gradient-to-r from-teal/60 to-teal"
                            initial={{ width: "5%" }}
                            animate={{ width: `${Math.max(progressPercent, 8)}%` }}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                        />
                        {/* Shimmer overlay on progress bar */}
                        <div
                            className="absolute inset-0 animate-shimmer"
                            style={{
                                background: "linear-gradient(90deg, transparent 33%, rgba(255,255,255,0.15) 50%, transparent 67%)",
                                backgroundSize: "200% 100%",
                            }}
                        />
                    </div>
                )}

                {/* Complete bar flash */}
                {status === "complete" && (
                    <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-success/60 to-success origin-left"
                    />
                )}

                <div className="px-6 py-5 space-y-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            {/* Icon with animated ring */}
                            {isActive && (
                                <div className="relative shrink-0">
                                    <motion.div
                                        className="flex items-center justify-center size-10 rounded-xl bg-teal/10 dark:bg-teal/20"
                                        animate={{ rotate: [0, 5, -5, 0] }}
                                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                    >
                                        <Sparkles className="size-5 text-teal" />
                                    </motion.div>
                                    <motion.div
                                        className="absolute -inset-1 rounded-xl border-2 border-teal/20 dark:border-teal/30"
                                        animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.2, 0.5] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                    />
                                </div>
                            )}
                            {status === "complete" && (
                                <motion.div
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                    className="flex items-center justify-center size-10 rounded-xl bg-success/10 dark:bg-success/20 shrink-0"
                                >
                                    <CheckCircle2 className="size-5 text-success" />
                                </motion.div>
                            )}
                            {status === "error" && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="flex items-center justify-center size-10 rounded-xl bg-destructive/10 dark:bg-destructive/20 shrink-0"
                                >
                                    <AlertCircle className="size-5 text-destructive" />
                                </motion.div>
                            )}

                            <div className="min-w-0">
                                <p className="text-base font-semibold text-foreground truncate">
                                    {status === "complete"
                                        ? "Search complete!"
                                        : status === "error"
                                            ? "Search failed"
                                            : `Searching for "${query}"`}
                                </p>
                                <AnimatePresence mode="wait">
                                    <motion.p
                                        key={strategyMessage}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.25 }}
                                        className="text-sm text-muted-foreground mt-0.5 truncate"
                                    >
                                        {isActive && strategyMessage}
                                        {status === "complete" &&
                                            `Found ${reposFound} repositories across ${strategiesComplete} strategies`}
                                        {status === "error" && (error || "Something went wrong")}
                                    </motion.p>
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Timer */}
                        {isActive && elapsed > 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground tabular-nums shrink-0 rounded-full bg-muted/50 dark:bg-muted px-2.5 py-1"
                            >
                                <Clock className="size-3" />
                                {formatTime(elapsed)}
                            </motion.div>
                        )}
                    </div>

                    {/* Stats chips */}
                    {(status === "searching" || status === "complete") && (
                        <div className="flex items-center gap-3">
                            {strategiesTotal > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-1.5 text-sm text-muted-foreground rounded-full bg-muted/50 dark:bg-muted px-3 py-1"
                                >
                                    {status === "searching" ? (
                                        <Loader2 className="size-3.5 animate-spin text-teal" />
                                    ) : (
                                        <CheckCircle2 className="size-3.5 text-success" />
                                    )}
                                    <span>
                                        <span className="font-semibold text-foreground tabular-nums">
                                            {strategiesComplete}
                                        </span>
                                        /{strategiesTotal} strategies
                                    </span>
                                </motion.div>
                            )}
                            {reposFound > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="flex items-center gap-1.5 text-sm text-muted-foreground rounded-full bg-muted/50 dark:bg-muted px-3 py-1"
                                >
                                    <Zap className="size-3.5 text-teal" />
                                    <span>
                                        <span className="font-semibold text-teal tabular-nums">
                                            {reposFound}
                                        </span>{" "}
                                        repos discovered
                                    </span>
                                </motion.div>
                            )}
                        </div>
                    )}

                    {/* Helper text */}
                    {isActive && elapsed < 10 && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1 }}
                            className="text-xs text-muted-foreground/60 leading-relaxed"
                        >
                            This typically takes 30–60 seconds. You can navigate away — we&apos;ll keep searching in the background.
                        </motion.p>
                    )}

                    {/* Action buttons */}
                    {status === "complete" && (
                        <motion.button
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                            whileHover={{ scale: 1.02, y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleViewResults}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-success hover:bg-success/90 text-white px-4 py-3 text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-300"
                        >
                            View Results
                            <ArrowRight className="size-4" />
                        </motion.button>
                    )}

                    {status === "error" && (
                        <p className="text-sm text-muted-foreground">
                            Please try searching again.
                        </p>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
