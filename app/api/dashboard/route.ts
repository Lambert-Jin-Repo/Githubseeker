import { NextRequest, NextResponse } from "next/server";
import { createServerClient, getSessionUserIdFromAuth } from "@/lib/supabase";
import { createAuthServerClient } from "@/lib/supabase/server";

/** GET /api/dashboard — Return aggregated stats for the current session */
export async function GET(request: NextRequest) {
    const authClient = await createAuthServerClient();
    const { userId } = await getSessionUserIdFromAuth(request, authClient);

    if (userId === "anonymous") {
        return NextResponse.json({
            totalSearches: 0,
            totalRepos: 0,
            topTopics: [],
            recentSearches: [],
        });
    }

    const db = createServerClient();

    // Fetch all searches for this user
    const { data: searches, error } = await db
        .from("searches")
        .select("id, query, mode, phase1_complete, phase2_complete, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Dashboard: failed to load searches:", error);
        return NextResponse.json(
            { error: "Failed to load dashboard data" },
            { status: 500 }
        );
    }

    const allSearches = searches || [];
    const totalSearches = allSearches.length;

    // Count total repos discovered across all searches
    const searchIds = allSearches.map((s: { id: string }) => s.id);
    let totalRepos = 0;

    if (searchIds.length > 0) {
        const { data: counts } = await db
            .rpc("count_results_by_search", { search_ids: searchIds });

        if (counts) {
            for (const row of counts as { count: number }[]) {
                totalRepos += Number(row.count);
            }
        }
    }

    // Compute top topics by frequency (simple word extraction from queries)
    const topicCounts = new Map<string, number>();
    for (const s of allSearches) {
        const query = (s as { query: string }).query.toLowerCase().trim();
        // Use the full query as a "topic" — more meaningful than individual words
        topicCounts.set(query, (topicCounts.get(query) || 0) + 1);
    }

    const topTopics = Array.from(topicCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic, count]) => ({ topic, count }));

    // Mode distribution
    const modeCounts = { LEARN: 0, BUILD: 0, SCOUT: 0 };
    for (const s of allSearches) {
        const mode = (s as { mode: string }).mode as keyof typeof modeCounts;
        if (mode in modeCounts) {
            modeCounts[mode]++;
        }
    }

    // Recent searches (top 5)
    const recentSearches = allSearches.slice(0, 5).map(
        (s: { id: string; query: string; mode: string; created_at: string; phase2_complete: boolean }) => ({
            id: s.id,
            query: s.query,
            mode: s.mode,
            created_at: s.created_at,
            phase2_complete: s.phase2_complete || false,
        })
    );

    return NextResponse.json({
        totalSearches,
        totalRepos,
        topTopics,
        modeCounts,
        recentSearches,
    });
}
