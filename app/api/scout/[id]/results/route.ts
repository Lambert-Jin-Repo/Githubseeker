import { NextRequest, NextResponse } from "next/server";
import { createServerClient, getSessionUserId } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing search ID" }, { status: 400 });
  }

  const userId = getSessionUserId(request);
  const db = createServerClient();

  // Fetch the search record (scoped to the requesting user)
  const { data: search, error: searchError } = await db
    .from("searches")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (searchError || !search) {
    return NextResponse.json({ error: "Search not found" }, { status: 404 });
  }

  // Fetch associated results
  const { data: results, error: resultsError } = await db
    .from("search_results")
    .select("*")
    .eq("search_id", id)
    .order("created_at", { ascending: true });

  if (resultsError) {
    console.error("Failed to load results:", resultsError);
    return NextResponse.json(
      { error: "Failed to load results" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    search: {
      id: search.id,
      query: search.query,
      mode: search.mode,
      topic_extracted: search.topic_extracted,
      observations: search.observations || [],
      phase1_complete: search.phase1_complete || false,
      phase2_complete: search.phase2_complete || false,
      created_at: search.created_at,
    },
    results: (results || []).map((r: Record<string, unknown>) => ({
      repo_url: r.repo_url,
      repo_name: r.repo_name,
      stars: r.stars,
      last_commit: r.last_commit,
      primary_language: r.primary_language,
      license: r.license,
      quality_tier: r.quality_tier,
      verification: r.verification || {},
      reddit_signal: r.reddit_signal || "no_data",
      summary: r.summary || "",
      source_strategies: r.source_strategies || [],
      is_selected: false,
      deep_dive: r.deep_dive || null,
    })),
  });
}
