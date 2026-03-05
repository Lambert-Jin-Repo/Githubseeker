import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";

type Range = "today" | "7d" | "30d";

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const range = (request.nextUrl.searchParams.get("range") || "today") as Range;
  if (!["today", "7d", "30d"].includes(range)) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const now = new Date();
  let start: string;
  switch (range) {
    case "today": {
      const s = new Date(now);
      s.setHours(0, 0, 0, 0);
      start = s.toISOString();
      break;
    }
    case "7d":
      start = new Date(now.getTime() - 7 * 86400000).toISOString();
      break;
    case "30d":
      start = new Date(now.getTime() - 30 * 86400000).toISOString();
      break;
  }

  const supabase = createServerClient();

  // Fetch searches in range
  const { data: searches } = await supabase
    .from("searches")
    .select("id, mode, query, topic_extracted, phase1_complete, created_at")
    .gte("created_at", start!)
    .order("created_at", { ascending: false })
    .limit(1000);

  const allSearches = searches || [];

  // Mode distribution
  const modeMap = new Map<string, number>();
  for (const s of allSearches) {
    modeMap.set(s.mode, (modeMap.get(s.mode) || 0) + 1);
  }
  const modeDistribution = Array.from(modeMap.entries()).map(
    ([mode, count]) => ({ mode, count })
  );

  // Top topics
  const topicMap = new Map<string, number>();
  for (const s of allSearches) {
    const topic = (s.topic_extracted || s.query || "").toLowerCase().trim();
    if (topic) topicMap.set(topic, (topicMap.get(topic) || 0) + 1);
  }
  const topTopics = Array.from(topicMap.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => (b.count as number) - (a.count as number))
    .slice(0, 10);

  // Searches per day
  const dayMap = new Map<string, number>();
  for (const s of allSearches) {
    const day = new Date(s.created_at).toISOString().split("T")[0];
    dayMap.set(day, (dayMap.get(day) || 0) + 1);
  }
  const searchesPerDay = Array.from(dayMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Completed searches count
  const completedSearches = allSearches.filter(
    (s) => s.phase1_complete
  ).length;

  // Avg repos per search -- count from search_results
  const searchIds = allSearches.map((s) => s.id);
  let avgReposPerSearch = 0;
  if (searchIds.length > 0) {
    const { count } = await supabase
      .from("search_results")
      .select("*", { count: "exact", head: true })
      .in("search_id", searchIds.slice(0, 100));
    avgReposPerSearch = count
      ? Math.round(count / Math.min(searchIds.length, 100))
      : 0;
  }

  // Cost per search (from api_usage_logs)
  let costPerSearch: { search_id: string; total_cost: number }[] = [];
  if (searchIds.length > 0) {
    const { data: costLogs } = await supabase
      .from("api_usage_logs")
      .select("search_id, cost_usd")
      .in("search_id", searchIds.slice(0, 100));

    if (costLogs) {
      const costMap = new Map<string, number>();
      for (const log of costLogs) {
        if (log.search_id) {
          costMap.set(
            log.search_id,
            (costMap.get(log.search_id) || 0) +
              parseFloat(log.cost_usd || "0")
          );
        }
      }
      costPerSearch = Array.from(costMap.entries())
        .map(([search_id, total_cost]) => ({
          search_id,
          total_cost: Math.round(total_cost * 1000000) / 1000000,
        }))
        .sort((a, b) => b.total_cost - a.total_cost)
        .slice(0, 10);
    }
  }

  return NextResponse.json({
    totalSearches: allSearches.length,
    completedSearches,
    modeDistribution,
    topTopics,
    searchesPerDay,
    avgReposPerSearch,
    costPerSearch,
  });
}
