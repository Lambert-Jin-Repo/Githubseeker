"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Search,
    GitFork,
    TrendingUp,
    BookOpen,
    Hammer,
    Compass,
    Clock,
    ArrowRight,
    BarChart3,
    RefreshCw,
} from "lucide-react";

interface DashboardData {
    totalSearches: number;
    totalRepos: number;
    topTopics: { topic: string; count: number }[];
    modeCounts: { LEARN: number; BUILD: number; SCOUT: number };
    recentSearches: {
        id: string;
        query: string;
        mode: string;
        created_at: string;
        phase2_complete: boolean;
    }[];
}

const modeConfig = {
    LEARN: { icon: BookOpen, label: "Learn", color: "text-blue-500 dark:text-blue-400" },
    BUILD: { icon: Hammer, label: "Build", color: "text-amber dark:text-amber" },
    SCOUT: { icon: Compass, label: "Scout", color: "text-teal dark:text-teal" },
};

function StatCard({
    icon: Icon,
    label,
    value,
    delay,
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    delay: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay }}
            className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-5 shadow-sm"
        >
            <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="size-4" />
                <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
            </div>
            <span className="font-serif text-3xl font-bold text-foreground">{value}</span>
        </motion.div>
    );
}

function SkeletonCard() {
    return (
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-5">
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-8 w-16 rounded bg-muted animate-pulse" />
        </div>
    );
}

function formatTimeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DashboardContent() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        setError(false);
        try {
            const res = await fetch("/api/dashboard");
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setData(json);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Loading skeleton
    if (loading) {
        return (
            <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
                <div className="h-40 rounded-xl border border-border/60 bg-card animate-pulse" />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
                    <BarChart3 className="size-6 text-destructive" />
                </div>
                <div>
                    <p className="font-serif text-lg font-semibold text-foreground">
                        Failed to load dashboard
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Something went wrong fetching your stats.
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                    <RefreshCw className="size-4" />
                    Try Again
                </button>
            </div>
        );
    }

    // Empty state
    if (!data || data.totalSearches === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-teal/10">
                    <Search className="size-6 text-teal" />
                </div>
                <div>
                    <p className="font-serif text-lg font-semibold text-foreground">
                        No searches yet
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                        Run your first search to see intelligence stats, topic trends, and mode distribution here.
                    </p>
                </div>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-medium text-teal-foreground transition-colors hover:bg-teal/90"
                >
                    Start Searching
                    <ArrowRight className="size-4" />
                </Link>
            </div>
        );
    }

    const totalModeSearches = data.modeCounts.LEARN + data.modeCounts.BUILD + data.modeCounts.SCOUT;

    return (
        <div className="space-y-8">
            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard icon={Search} label="Total Searches" value={data.totalSearches} delay={0} />
                <StatCard icon={GitFork} label="Repos Discovered" value={data.totalRepos} delay={0.05} />
                <StatCard icon={TrendingUp} label="Top Topics" value={data.topTopics.length} delay={0.1} />
            </div>

            {/* Mode distribution */}
            {totalModeSearches > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15 }}
                    className="rounded-xl border border-border/60 bg-card p-5"
                >
                    <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Search Mode Distribution
                    </h2>
                    <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-muted">
                        {(["LEARN", "BUILD", "SCOUT"] as const).map((mode) => {
                            const count = data.modeCounts[mode];
                            if (count === 0) return null;
                            const pct = (count / totalModeSearches) * 100;
                            const colors = {
                                LEARN: "bg-blue-500",
                                BUILD: "bg-amber",
                                SCOUT: "bg-teal",
                            };
                            return (
                                <div
                                    key={mode}
                                    className={`${colors[mode]} rounded-full transition-all duration-500`}
                                    style={{ width: `${pct}%` }}
                                    title={`${mode}: ${count} searches (${Math.round(pct)}%)`}
                                />
                            );
                        })}
                    </div>
                    <div className="mt-3 flex gap-5">
                        {(["LEARN", "BUILD", "SCOUT"] as const).map((mode) => {
                            const cfg = modeConfig[mode];
                            const Icon = cfg.icon;
                            return (
                                <div key={mode} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Icon className={`size-3.5 ${cfg.color}`} />
                                    <span>{cfg.label}</span>
                                    <span className="font-semibold text-foreground">{data.modeCounts[mode]}</span>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top topics */}
                {data.topTopics.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                        className="rounded-xl border border-border/60 bg-card p-5"
                    >
                        <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Top Topics
                        </h2>
                        <ul className="space-y-3">
                            {data.topTopics.map((t, i) => (
                                <li key={t.topic} className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="flex-shrink-0 text-xs font-mono font-medium text-muted-foreground/60 w-4 text-right">
                                            {i + 1}
                                        </span>
                                        <span className="truncate text-sm text-foreground">{t.topic}</span>
                                    </div>
                                    <span className="flex-shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                        {t.count}×
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                )}

                {/* Recent activity */}
                {data.recentSearches.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.25 }}
                        className="rounded-xl border border-border/60 bg-card p-5"
                    >
                        <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Recent Activity
                        </h2>
                        <ul className="space-y-3">
                            {data.recentSearches.map((s) => {
                                const cfg = modeConfig[s.mode as keyof typeof modeConfig] || modeConfig.SCOUT;
                                const Icon = cfg.icon;
                                return (
                                    <li key={s.id}>
                                        <Link
                                            href={`/scout/${s.id}`}
                                            className="group flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-muted/50"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <Icon className={`size-3.5 flex-shrink-0 ${cfg.color}`} />
                                                <span className="truncate text-sm text-foreground group-hover:text-teal transition-colors">
                                                    {s.query}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Clock className="size-3" />
                                                    {formatTimeAgo(s.created_at)}
                                                </span>
                                            </div>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
