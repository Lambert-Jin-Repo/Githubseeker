"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  MetricCards,
  TimeRangeFilter,
  CostTimelineChart,
  ProviderBreakdownChart,
  OperationBarChart,
  ErrorRateChart,
  SearchAnalyticsPanel,
  RecentCallsTable,
} from "./components";

// ---- Types ----

type Range = "today" | "7d" | "30d";

interface MetricsData {
  summary: {
    totalCalls: number;
    successRate: number;
    avgLatencyMs: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalCostUsd: number;
    totalSearches: number;
  };
  byProvider: Array<{
    provider: string;
    calls: number;
    successRate: number;
    avgLatencyMs: number;
    totalCost: number;
  }>;
  byOperation: Array<{
    operation: string;
    calls: number;
    avgLatencyMs: number;
    totalCost: number;
  }>;
  timeline: Array<{
    time: string;
    [key: string]: string | number;
    cost: number;
  }>;
  errors: Array<{
    time: string;
    provider: string;
    operation: string;
    error_type: string;
  }>;
  recentCalls: Array<{
    created_at: string;
    provider: string;
    model: string;
    operation: string;
    success: boolean;
    latency_ms: number;
    tokens_in: number;
    tokens_out: number;
    cost_usd: string;
    error_type: string;
    tool_round: number;
  }>;
}

interface SearchAnalyticsData {
  totalSearches: number;
  completedSearches: number;
  modeDistribution: Array<{ mode: string; count: number }>;
  topTopics: Array<{ topic: string; count: number }>;
  searchesPerDay: Array<{ date: string; count: number }>;
  avgReposPerSearch: number;
  costPerSearch: Array<{ search_id: string; total_cost: number }>;
}

// ---- Skeleton ----

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Metric cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-card border border-border shadow-sm p-5 h-24"
          >
            <div className="h-3 w-20 bg-muted rounded mb-4" />
            <div className="h-6 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-card border border-border shadow-sm p-6 h-80"
          >
            <div className="h-3 w-32 bg-muted rounded mb-6" />
            <div className="h-56 bg-muted/50 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Page ----

export default function LlmUsageDashboard() {
  const router = useRouter();
  const [range, setRange] = useState<Range>("today");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [searchAnalytics, setSearchAnalytics] =
    useState<SearchAnalyticsData | null>(null);
  const [error, setError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      setError("");

      try {
        const [metricsRes, searchRes] = await Promise.all([
          fetch(`/api/admin/metrics?range=${range}`),
          fetch(`/api/admin/search-analytics?range=${range}`),
        ]);

        if (metricsRes.status === 401 || searchRes.status === 401) {
          router.push("/admin/login");
          return;
        }

        if (!metricsRes.ok || !searchRes.ok) {
          setError("Failed to fetch dashboard data");
          setLoading(false);
          return;
        }

        const [metricsData, searchData] = await Promise.all([
          metricsRes.json(),
          searchRes.json(),
        ]);

        setMetrics(metricsData);
        setSearchAnalytics(searchData);
      } catch {
        setError("Network error. Please check your connection.");
      } finally {
        setLoading(false);
      }
    },
    [range, router]
  );

  // Initial fetch + range change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => fetchData(false), 15000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchData]);

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  // Extract unique providers from timeline data
  const providers = metrics
    ? Array.from(
        new Set(
          metrics.timeline.flatMap((t) =>
            Object.keys(t).filter((k) => k !== "time" && k !== "cost")
          )
        )
      )
    : [];

  const isEmpty =
    metrics &&
    metrics.summary.totalCalls === 0 &&
    (!searchAnalytics || searchAnalytics.totalSearches === 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground font-serif">
              API Usage Dashboard
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Git Scout Admin
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-background border border-border transition-all duration-200"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
              />
            </svg>
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Filters */}
        <TimeRangeFilter
          range={range}
          onRangeChange={setRange}
          autoRefresh={autoRefresh}
          onAutoRefreshChange={setAutoRefresh}
        />

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && <DashboardSkeleton />}

        {/* Empty state */}
        {!loading && isEmpty && (
          <div className="rounded-xl bg-card border border-border shadow-sm p-12 text-center">
            <svg
              className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-1 2.148 2.148A12.061 12.061 0 0116.5 7.605"
              />
            </svg>
            <h2 className="text-lg font-semibold text-foreground font-serif mb-1">
              No Data Yet
            </h2>
            <p className="text-sm text-muted-foreground">
              API usage data will appear here once searches are made.
            </p>
          </div>
        )}

        {/* Dashboard content */}
        {!loading && metrics && !isEmpty && (
          <>
            {/* Metric Cards */}
            <MetricCards summary={metrics.summary} />

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CostTimelineChart
                data={metrics.timeline}
                providers={providers}
              />
              <ProviderBreakdownChart data={metrics.byProvider} />
              <OperationBarChart data={metrics.byOperation} />
              <ErrorRateChart errors={metrics.errors} />
            </div>

            {/* Search Analytics */}
            {searchAnalytics && (
              <SearchAnalyticsPanel data={searchAnalytics} />
            )}

            {/* Recent Calls Table */}
            <RecentCallsTable calls={metrics.recentCalls} />
          </>
        )}
      </main>
    </div>
  );
}
