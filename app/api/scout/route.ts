import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { callLLMWithTools } from "@/lib/llm";
import { detectMode } from "@/lib/mode-detection";
import { deduplicateRepos } from "@/lib/url-normalize";
import { createServerClient, getSessionUserIdFromAuth } from "@/lib/supabase";
import { createAuthServerClient } from "@/lib/supabase/server";
import { checkAnonymousRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/auth";
import { analyzeReposV2Batch } from "@/lib/deep-dive-analyzer-v2";
import { buildSystemPrompt, buildUserMessage, parseRepoFromRaw } from "@/lib/scout/result-parser";
import type {
  ScoutMode,
  ScoutRequest,
  RepoResult,
} from "@/lib/types";

import { sseEncode, SSE_HEADERS } from "@/lib/sse";

// POST /api/scout — Start a new search, returns { id } for SSE connection
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScoutRequest & { force_refresh?: boolean };
    const { query, mode: requestedMode, force_refresh } = body;

    if (!query || query.trim().length < 3 || query.trim().length > 200) {
      return NextResponse.json(
        { error: "Query must be 3-200 characters" },
        { status: 400 }
      );
    }

    // Auto-detect mode if not provided
    let mode: ScoutMode = requestedMode || "SCOUT";
    if (!requestedMode) {
      const detected = detectMode(query);
      if (detected.mode) mode = detected.mode;
    }

    const trimmedQuery = query.trim();

    // Determine if user is authenticated
    const authClient = await createAuthServerClient();
    const { userId, isAuthenticated } = await getSessionUserIdFromAuth(request, authClient);

    // Rate limit anonymous users
    if (!isAuthenticated) {
      const ip = getClientIp(request.headers);
      const rateLimit = await checkAnonymousRateLimit(ip);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: "rate_limited",
            message: "You've used your 2 free searches. Sign in with Google to unlock unlimited searches.",
            remaining: 0,
          },
          { status: 429 }
        );
      }
    }

    // Check for cached results (same user + query within last 24 hours)
    if (!force_refresh) {
      try {
        const supabase = createServerClient();
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: cached } = await supabase
          .from("searches")
          .select("id, mode")
          .eq("user_id", userId)
          .eq("query", trimmedQuery)
          .eq("phase1_complete", true)
          .gte("created_at", twentyFourHoursAgo)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (cached) {
          return NextResponse.json({ id: cached.id, mode: cached.mode, cached: true });
        }
      } catch {
        // No cached result found, proceed with new search
      }
    }

    const searchId = uuidv4();

    // Persist to Supabase (awaited to ensure row exists before GET handler updates it)
    try {
      const supabase = createServerClient();
      const { error } = await supabase.from("searches").insert({
        id: searchId,
        user_id: userId,
        query: trimmedQuery,
        mode,
      });
      if (error) {
        console.error("[scout/POST] Supabase insert error:", error.message);
      }
    } catch (err) {
      console.error("[scout/POST] Failed to persist search:", err);
    }

    return NextResponse.json({ id: searchId, mode });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

// GET /api/scout?id=xxx — SSE stream of search results
export async function GET(request: NextRequest) {
  const searchId = request.nextUrl.searchParams.get("id");

  if (!searchId) {
    return NextResponse.json({ error: "Missing search ID" }, { status: 400 });
  }

  // Verify the search belongs to the requesting user
  const authClient = await createAuthServerClient();
  const { userId } = await getSessionUserIdFromAuth(request, authClient);

  // Read search params from Supabase and verify ownership
  const db = createServerClient();
  const { data: row } = await db
    .from("searches")
    .select("query, mode")
    .eq("id", searchId)
    .eq("user_id", userId)
    .single();

  if (!row) {
    return NextResponse.json({ error: "Search not found or expired" }, { status: 404 });
  }
  const searchParams = { query: row.query, mode: row.mode as ScoutMode };

  const { query, mode } = searchParams;

  const encoder = new TextEncoder();
  const abortController = new AbortController();

  const stream = new ReadableStream({
    start(controller) {

      // Track search strategies as they happen
      const strategiesSeen = new Set<string>();
      let repoCount = 0;
      let closed = false;

      function send(event: string, data: unknown) {
        try {
          controller.enqueue(encoder.encode(sseEncode(event, data)));
        } catch {
          // Stream may have been closed
        }
      }

      function safeClose() {
        if (!closed) {
          closed = true;
          try { controller.close(); } catch { /* already closed */ }
        }
      }

      // Emit initial mode detection
      const modeResult = detectMode(query);
      const isVagueQuery = modeResult.confidence === 0;
      send("mode_detected", {
        mode,
        topic: query,
        confidence: modeResult.confidence || 0.8,
      });

      // Run the LLM agentic loop
      callLLMWithTools({
        systemPrompt: buildSystemPrompt(mode, isVagueQuery),
        userMessage: buildUserMessage(query, mode),
        searchId,
        operation: "phase1_search",
        onToolError(toolName, error) {
          if (toolName === "web_search") {
            send("search_error", {
              strategy: Array.from(strategiesSeen).pop() || "general",
              message: error.message,
            });
            // Mark the most recent strategy as failed
            const lastStrategy = Array.from(strategiesSeen).pop();
            if (lastStrategy) {
              send("search_progress", {
                strategy: lastStrategy,
                status: "failed",
                repos_found: 0,
              });
            }
          }
        },
        onToolCall(toolName, args) {
          if (toolName === "web_search") {
            const searchQuery = (args.query as string) || "";
            let strategy = "general";
            if (searchQuery.includes("stars") || searchQuery.includes("popular")) strategy = "high_star";
            else if (searchQuery.includes("awesome")) strategy = "awesome_list";
            else if (searchQuery.includes("best") || searchQuery.includes("roundup")) strategy = "editorial";
            else if (searchQuery.includes("architecture") || searchQuery.includes("design")) strategy = "architecture";
            else if (searchQuery.includes("alternative")) strategy = "competitive";
            else if (searchQuery.includes("github.com/topics")) strategy = "github_topics";
            else if (searchQuery.includes("site:github.com") && !searchQuery.includes("awesome") && !searchQuery.includes("stars")) strategy = "direct_discovery";

            if (!strategiesSeen.has(strategy)) {
              strategiesSeen.add(strategy);
              send("search_progress", {
                strategy,
                status: "running",
                repos_found: 0,
              });
            }
          }
          if (toolName === "web_fetch") {
            const url = args.url as string;
            if (url?.includes("github.com")) {
              send("verification_update", {
                repo_url: url,
                verification: {
                  existence: { status: "live", checked_at: new Date().toISOString() },
                },
              });
            }
          }
        },
        onToolResult(toolName, result) {
          if (toolName === "web_search") {
            try {
              const results = JSON.parse(result);
              if (Array.isArray(results)) {
                const ghRepos = results.filter(
                  (r: { url: string }) => r.url?.includes("github.com")
                );
                repoCount += ghRepos.length;

                // Mark the most recent strategy as complete
                const lastStrategy = Array.from(strategiesSeen).pop();
                if (lastStrategy) {
                  send("search_progress", {
                    strategy: lastStrategy,
                    status: "complete",
                    repos_found: ghRepos.length,
                  });
                }
              }
            } catch {
              // Result might not be JSON
            }
          }
        },
        maxToolRounds: isVagueQuery ? 10 : 8,
        signal: abortController.signal,
      })
        .then(async (finalResponse) => {
          // Parse the JSON response from LLM
          let dedupedRepos: RepoResult[] = [];
          let observations: string[] = [];
          let topicExtracted: string | null = null;

          try {
            // Strip MiniMax <think> reasoning tags before parsing
            let jsonStr = finalResponse.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

            // Try to extract JSON from markdown code fences
            const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
              jsonStr = jsonMatch[1].trim();
            }
            // Also try extracting raw JSON object
            const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (braceMatch) {
              jsonStr = braceMatch[0];
            }

            const parsed = JSON.parse(jsonStr);

            // Extract topic
            topicExtracted = (parsed.topic as string) || null;

            // Emit observations
            if (Array.isArray(parsed.observations)) {
              observations = parsed.observations.filter(
                (o: unknown): o is string => typeof o === "string"
              );
              for (const obs of observations) {
                send("observation", { text: obs });
              }
            }

            // Parse and emit repos
            const rawRepos = Array.isArray(parsed.repos) ? parsed.repos : [];
            const repos = rawRepos.map((r: Record<string, unknown>) => parseRepoFromRaw(r));
            dedupedRepos = deduplicateRepos(repos);

            for (const repo of dedupedRepos) {
              send("repo_discovered", repo);
            }

            // Emit curated lists
            if (Array.isArray(parsed.curated_lists)) {
              for (const list of parsed.curated_lists) {
                send("curated_list", list);
              }
            }

            // Emit industry tools
            if (Array.isArray(parsed.industry_tools)) {
              for (const tool of parsed.industry_tools) {
                send("industry_tool", tool);
              }
            }

            // Emit completion
            const verified = dedupedRepos.filter(
              (r: RepoResult) => r.verification.existence.status === "live"
            ).length;

            send("phase1_complete", {
              total_repos: dedupedRepos.length,
              verified,
              unverified: dedupedRepos.length - verified,
            });

            // Close SSE stream immediately so the client gets phase1_complete without delay
            safeClose();
          } catch (parseError) {
            console.error("[scout/GET] Parse error:", parseError);
            console.error("[scout/GET] Raw LLM response (first 2000 chars):", finalResponse.slice(0, 2000));
            send("error", {
              message: "Failed to parse search results. The AI may have returned malformed data.",
              recoverable: true,
            });
            safeClose();
          }

          // Persist results to Supabase (after stream is closed)
          try {
            const supabase = createServerClient();

            // Batch-insert deduped repos into search_results
            if (dedupedRepos.length > 0) {
              const rows = dedupedRepos.map((repo) => ({
                search_id: searchId,
                repo_url: repo.repo_url,
                repo_name: repo.repo_name,
                stars: repo.stars,
                last_commit: repo.last_commit,
                primary_language: repo.primary_language,
                license: repo.license,
                quality_tier: repo.quality_tier,
                verification: repo.verification,
                reddit_signal: repo.reddit_signal,
                summary: repo.summary,
                source_strategies: repo.source_strategies,
              }));

              const { error: insertError } = await supabase
                .from("search_results")
                .insert(rows);
              if (insertError) {
                console.error("[scout/GET] Supabase search_results insert error:", insertError.message);
              }
            }

            // Update searches row with completion data
            const { error: updateError } = await supabase
              .from("searches")
              .update({
                phase1_complete: true,
                observations,
                topic_extracted: topicExtracted,
              })
              .eq("id", searchId);
            if (updateError) {
              console.error("[scout/GET] Supabase searches update error:", updateError.message);
            }
          } catch (err) {
            console.error("[scout/GET] Failed to persist results:", err);
          }

          // Fire-and-forget: pre-compute deep dives for Tier 1 repos only (top 5)
          const tier1Repos = dedupedRepos
            .filter((r) => r.quality_tier === 1)
            .slice(0, 5);
          if (tier1Repos.length > 0) {
            const urls = tier1Repos.map((r) => r.repo_url);
            analyzeReposV2Batch(urls, searchId).catch((err) =>
              console.error("[scout/GET] Background precompute failed:", err)
            );
          }
        })
        .catch((err) => {
          // If we already have some repos, send partial completion before the error
          if (repoCount > 0) {
            send("phase1_complete", {
              total_repos: repoCount,
              verified: 0,
              unverified: repoCount,
              partial: true,
            });
          }
          send("error", {
            message: err instanceof Error ? err.message : "Search failed",
            recoverable: true,
          });
          safeClose();
        });
    },
    cancel() {
      // Client disconnected — abort in-flight LLM/tool calls
      abortController.abort();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
