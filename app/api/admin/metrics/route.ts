import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";

type Range = "today" | "7d" | "30d";

function getDateRange(range: Range): { start: string; truncation: string } {
  const now = new Date();
  switch (range) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString(), truncation: "hour" };
    }
    case "7d":
      return {
        start: new Date(now.getTime() - 7 * 86400000).toISOString(),
        truncation: "day",
      };
    case "30d":
      return {
        start: new Date(now.getTime() - 30 * 86400000).toISOString(),
        truncation: "day",
      };
  }
}

export async function GET(request: NextRequest) {
  // Auth check
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Parse range
  const range = (request.nextUrl.searchParams.get("range") || "today") as Range;
  if (!["today", "7d", "30d"].includes(range)) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const { start, truncation } = getDateRange(range);
  const supabase = createServerClient();

  // Fetch all logs for the range
  const { data: logs, error: fetchError } = await supabase
    .from("api_usage_logs")
    .select("*")
    .gte("created_at", start)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (fetchError) {
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }

  const allLogs = logs || [];

  // Summary stats
  const totalCalls = allLogs.length;
  const successCalls = allLogs.filter(
    (l: Record<string, unknown>) => l.success
  ).length;
  const successRate =
    totalCalls > 0
      ? Math.round((successCalls / totalCalls) * 1000) / 10
      : 0;
  const avgLatencyMs =
    totalCalls > 0
      ? Math.round(
          allLogs.reduce(
            (sum: number, l: Record<string, unknown>) =>
              sum + ((l.latency_ms as number) || 0),
            0
          ) / totalCalls
        )
      : 0;
  const totalTokensIn = allLogs.reduce(
    (sum: number, l: Record<string, unknown>) =>
      sum + ((l.tokens_in as number) || 0),
    0
  );
  const totalTokensOut = allLogs.reduce(
    (sum: number, l: Record<string, unknown>) =>
      sum + ((l.tokens_out as number) || 0),
    0
  );
  const totalCostUsd = allLogs.reduce(
    (sum: number, l: Record<string, unknown>) =>
      sum + parseFloat((l.cost_usd as string) || "0"),
    0
  );

  // Count unique search_ids
  const uniqueSearchIds = new Set(
    allLogs
      .filter((l: Record<string, unknown>) => l.search_id)
      .map((l: Record<string, unknown>) => l.search_id)
  );
  const totalSearches = uniqueSearchIds.size;

  // By provider
  const providerMap = new Map<
    string,
    { calls: number; successes: number; totalLatency: number; totalCost: number }
  >();
  for (const log of allLogs) {
    const entry = providerMap.get(log.provider as string) || {
      calls: 0,
      successes: 0,
      totalLatency: 0,
      totalCost: 0,
    };
    entry.calls++;
    if (log.success) entry.successes++;
    entry.totalLatency += (log.latency_ms as number) || 0;
    entry.totalCost += parseFloat((log.cost_usd as string) || "0");
    providerMap.set(log.provider as string, entry);
  }
  const byProvider = Array.from(providerMap.entries()).map(
    ([provider, stats]) => ({
      provider,
      calls: stats.calls,
      successRate:
        Math.round((stats.successes / stats.calls) * 1000) / 10,
      avgLatencyMs: Math.round(stats.totalLatency / stats.calls),
      totalCost: Math.round(stats.totalCost * 1000000) / 1000000,
    })
  );

  // By operation
  const operationMap = new Map<
    string,
    { calls: number; totalLatency: number; totalCost: number }
  >();
  for (const log of allLogs) {
    const entry = operationMap.get(log.operation as string) || {
      calls: 0,
      totalLatency: 0,
      totalCost: 0,
    };
    entry.calls++;
    entry.totalLatency += (log.latency_ms as number) || 0;
    entry.totalCost += parseFloat((log.cost_usd as string) || "0");
    operationMap.set(log.operation as string, entry);
  }
  const byOperation = Array.from(operationMap.entries())
    .map(([operation, stats]) => ({
      operation,
      calls: stats.calls,
      avgLatencyMs: Math.round(stats.totalLatency / stats.calls),
      totalCost: Math.round(stats.totalCost * 1000000) / 1000000,
    }))
    .sort((a, b) => b.calls - a.calls);

  // Timeline
  const timelineMap = new Map<string, Record<string, number>>();
  for (const log of allLogs) {
    const date = new Date(log.created_at as string);
    if (truncation === "hour") {
      date.setMinutes(0, 0, 0);
    } else {
      date.setHours(0, 0, 0, 0);
    }
    const key = date.toISOString();
    const bucket = timelineMap.get(key) || { cost: 0 };
    bucket[log.provider as string] =
      (bucket[log.provider as string] || 0) + 1;
    bucket.cost =
      (bucket.cost || 0) + parseFloat((log.cost_usd as string) || "0");
    timelineMap.set(key, bucket);
  }
  const timeline = Array.from(timelineMap.entries())
    .map(([time, data]) => ({ time, ...data }))
    .sort((a, b) => a.time.localeCompare(b.time));

  // Errors
  const errors = allLogs
    .filter((l: Record<string, unknown>) => !l.success)
    .slice(0, 20)
    .map((l: Record<string, unknown>) => ({
      time: l.created_at,
      provider: l.provider,
      operation: l.operation,
      error_type: l.error_type,
    }));

  // Recent calls (last 50)
  const recentCalls = allLogs
    .slice(0, 50)
    .map((l: Record<string, unknown>) => ({
      created_at: l.created_at,
      provider: l.provider,
      model: l.model,
      operation: l.operation,
      success: l.success,
      latency_ms: l.latency_ms,
      tokens_in: l.tokens_in,
      tokens_out: l.tokens_out,
      cost_usd: l.cost_usd,
      error_type: l.error_type,
      tool_round: l.tool_round,
    }));

  return NextResponse.json({
    summary: {
      totalCalls,
      successRate,
      avgLatencyMs,
      totalTokensIn,
      totalTokensOut,
      totalCostUsd: Math.round(totalCostUsd * 1000000) / 1000000,
      totalSearches,
    },
    byProvider,
    byOperation,
    timeline,
    errors,
    recentCalls,
  });
}
