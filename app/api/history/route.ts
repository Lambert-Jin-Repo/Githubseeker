import { NextRequest, NextResponse } from "next/server";
import { createServerClient, getSessionUserIdFromAuth } from "@/lib/supabase";
import { createAuthServerClient } from "@/lib/supabase/server";

const MAX_HISTORY_ITEMS = 20;

/** GET /api/history — Return recent searches for the current session */
export async function GET(request: NextRequest) {
  const authClient = await createAuthServerClient();
  const userId = await getSessionUserIdFromAuth(request, authClient);

  if (userId === "anonymous") {
    return NextResponse.json({ items: [] });
  }

  const db = createServerClient();

  const { data: searches, error } = await db
    .from("searches")
    .select("id, query, mode, phase2_complete, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY_ITEMS);

  if (error) {
    console.error("Failed to load history:", error);
    return NextResponse.json({ items: [] });
  }

  // Get repo counts per search
  const searchIds = searches.map((s: { id: string }) => s.id);
  if (searchIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const { data: counts, error: countError } = await db
    .rpc("count_results_by_search", { search_ids: searchIds });

  const repoCountMap = new Map<string, number>();
  if (!countError && counts) {
    for (const row of counts as { search_id: string; count: number }[]) {
      repoCountMap.set(row.search_id, Number(row.count));
    }
  }

  const items = searches.map((s: { id: string; query: string; mode: string; phase2_complete: boolean; created_at: string }) => ({
    id: s.id,
    query: s.query,
    mode: s.mode,
    repos_found: repoCountMap.get(s.id) || 0,
    created_at: s.created_at,
    phase2_complete: s.phase2_complete || false,
  }));

  return NextResponse.json({ items });
}
