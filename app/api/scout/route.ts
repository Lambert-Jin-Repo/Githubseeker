import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { callLLMWithTools } from "@/lib/llm";
import { detectMode } from "@/lib/mode-detection";
import { normalizeGitHubUrl, deduplicateRepos } from "@/lib/url-normalize";
import { createServerClient, getSessionUserIdFromAuth } from "@/lib/supabase";
import { createAuthServerClient } from "@/lib/supabase/server";
import { checkAnonymousRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/auth";
import { analyzeReposV2Batch } from "@/lib/deep-dive-analyzer-v2";
import type {
  ScoutMode,
  ScoutRequest,
  RepoResult,
  RepoVerification,
  QualityTier,
  RedditSignal,
} from "@/lib/types";

function buildSystemPrompt(mode: ScoutMode, isVagueQuery: boolean): string {
  const modeLabel = isVagueQuery ? `${mode} (broad discovery)` : mode;
  const modeGuidance = isVagueQuery
    ? "\nThe query is broad — explore the ecosystem widely. Search across different angles and sub-topics rather than focusing on competitive positioning.\n"
    : "";

  return `You are GitHub Scout, an AI-powered repository intelligence agent operating in ${modeLabel} mode.

Your job is to discover, verify, and evaluate open-source GitHub repositories for a given topic.
${modeGuidance}
## Your Tools
- web_search: Search the web using Google. Pass count: 20 for more results.
- web_fetch: Fetch a web page. For GitHub repo URLs (github.com/owner/repo), returns structured JSON with stars, language, license, description, topics, and last commit date. For other URLs, returns raw HTML.

## Phase 1 Discovery Workflow

IMPORTANT: Execute ALL 6 search strategies simultaneously in your first response. Call all 6 web_search tools at once — do not wait for results before starting the next search.

1. **High-star repos**: Search "site:github.com {topic} stars" with count 20
2. **Awesome lists**: Search "site:github.com awesome-{topic}" with count 20
3. **Editorial roundups**: Search "best open source {topic} 2025 2026" with count 20
${mode === "SCOUT" ? '4. **Competitive landscape**: Search "{topic} open source alternatives 2025 2026" with count 20' : `4. **Architecture patterns**: Search "{topic} system design architecture github" with count 20`}
5. **Direct discovery**: Search "site:github.com {topic}" with count 20
6. **GitHub topics**: Search "github.com/topics/{topic} repositories" with count 20

## Verification Requirements

- After discovery, use web_fetch to verify the **top 8-12** most promising repos (Tier 1 candidates). Batch all web_fetch calls in a single response for parallel execution.
- web_fetch on a GitHub repo URL returns structured JSON metadata — no need to parse HTML yourself.
- For remaining repos, use metadata from search snippets and mark verification level as "inferred".
- Do NOT fabricate or guess star counts, dates, or other data.
- Do NOT search Reddit — community analysis is handled by the deep dive phase.

## Quality Tier Assignment
- Tier 1 (★★★): >1000 stars, active within 6 months, strong community signal
- Tier 2 (★★): 100-1000 stars OR active with good documentation
- Tier 3 (★): <100 stars but relevant, or stale but historically important

## Output Format

After all searches and verifications, return a JSON object with this exact structure:
{
  "topic": "extracted topic from user query",
  "observations": ["observation 1 about the landscape", "observation 2", "observation 3"],
  "repos": [
    {
      "repo_url": "https://github.com/owner/repo",
      "repo_name": "owner/repo",
      "stars": 12500,
      "last_commit": "2026-02-15",
      "primary_language": "TypeScript",
      "license": "MIT",
      "quality_tier": 1,
      "reddit_signal": "no_data",
      "summary": "One-line description of what this repo does and why it matters",
      "source_strategies": ["high_star", "awesome_list"],
      "verification": {
        "existence": { "status": "live", "checked_at": "2026-02-25T00:00:00Z" },
        "stars": { "value": 12500, "level": "verified", "source": "github" },
        "last_commit": { "value": "2026-02-15", "level": "verified" },
        "language": { "value": "TypeScript", "level": "verified" },
        "license": { "value": "MIT", "level": "verified" },
        "freshness": { "status": "active", "level": "verified" },
        "community": { "signal": "no_data", "level": "inferred" }
      }
    }
  ],
  "curated_lists": [
    { "name": "awesome-topic", "url": "https://github.com/...", "description": "..." }
  ],
  "industry_tools": [
    { "name": "Tool Name", "description": "Non-GitHub tool relevant to topic", "url": "..." }
  ]
}

IMPORTANT:
- Return ONLY the JSON object, no markdown code fences, no extra text
- Aim for 15-25 repos total across all strategies
- Deduplicate by repository URL
- Be efficient: batch web_fetch calls, do not verify every single repo`;
}

function buildUserMessage(query: string, mode: ScoutMode): string {
  return `Search for: "${query}"

Mode: ${mode}
${mode === "LEARN" ? "Focus on repos with good documentation, tutorials, and beginner-friendly codebases." : ""}
${mode === "BUILD" ? "Focus on repos with production-ready templates, good architecture, and active maintenance." : ""}
${mode === "SCOUT" ? "Focus on the competitive landscape, alternatives, and emerging tools in this space." : ""}

Execute all search strategies, verify each repo, and return the structured JSON result.`;
}

function parseRepoFromRaw(raw: Record<string, unknown>): RepoResult {
  const verification = raw.verification as Record<string, unknown> | undefined;
  const now = new Date().toISOString();

  const defaultVerification: RepoVerification = {
    existence: { status: "live", checked_at: now },
    stars: { value: (raw.stars as number) || 0, level: "inferred", source: "llm" },
    last_commit: { value: (raw.last_commit as string) || "", level: "inferred" },
    language: { value: (raw.primary_language as string) || "", level: "inferred" },
    license: { value: (raw.license as string) || "", level: "inferred" },
    freshness: { status: "active", level: "inferred" },
    community: { signal: (raw.reddit_signal as RedditSignal) || "no_data", level: "inferred" },
  };

  let parsedVerification = defaultVerification;
  if (verification && typeof verification === "object") {
    try {
      parsedVerification = {
        existence: (verification.existence as RepoVerification["existence"]) || defaultVerification.existence,
        stars: (verification.stars as RepoVerification["stars"]) || defaultVerification.stars,
        last_commit: (verification.last_commit as RepoVerification["last_commit"]) || defaultVerification.last_commit,
        language: (verification.language as RepoVerification["language"]) || defaultVerification.language,
        license: (verification.license as RepoVerification["license"]) || defaultVerification.license,
        freshness: (verification.freshness as RepoVerification["freshness"]) || defaultVerification.freshness,
        community: (verification.community as RepoVerification["community"]) || defaultVerification.community,
      };
    } catch {
      parsedVerification = defaultVerification;
    }
  }

  return {
    repo_url: normalizeGitHubUrl((raw.repo_url as string) || ""),
    repo_name: (raw.repo_name as string) || "",
    stars: typeof raw.stars === "number" ? raw.stars : null,
    last_commit: (raw.last_commit as string) || null,
    primary_language: (raw.primary_language as string) || null,
    license: (raw.license as string) || null,
    quality_tier: ([1, 2, 3].includes(raw.quality_tier as number) ? raw.quality_tier : 3) as QualityTier,
    verification: parsedVerification,
    reddit_signal: (["validated", "mixed", "no_data"].includes(raw.reddit_signal as string)
      ? raw.reddit_signal
      : "no_data") as RedditSignal,
    summary: (raw.summary as string) || "",
    source_strategies: Array.isArray(raw.source_strategies) ? raw.source_strategies : [],
    is_selected: false,
  };
}

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

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

    // Store the search params in a simple in-memory map for the GET handler
    pendingSearches.set(searchId, { query: trimmedQuery, mode });

    // Clean up old entries after 5 minutes
    setTimeout(() => pendingSearches.delete(searchId), 5 * 60 * 1000);

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

// In-memory store for pending search parameters
const pendingSearches = new Map<string, { query: string; mode: ScoutMode }>();

// GET /api/scout?id=xxx — SSE stream of search results
export async function GET(request: NextRequest) {
  const searchId = request.nextUrl.searchParams.get("id");

  if (!searchId) {
    return NextResponse.json({ error: "Missing search ID" }, { status: 400 });
  }

  // Verify the search belongs to the requesting user
  const authClient = await createAuthServerClient();
  const { userId } = await getSessionUserIdFromAuth(request, authClient);

  const searchParams = pendingSearches.get(searchId);
  if (!searchParams) {
    return NextResponse.json({ error: "Search not found or expired" }, { status: 404 });
  }

  // Verify ownership: check that the persisted search row belongs to this user
  const db = createServerClient();
  const { data: searchRow } = await db
    .from("searches")
    .select("id")
    .eq("id", searchId)
    .eq("user_id", userId)
    .single();

  if (!searchRow) {
    return NextResponse.json({ error: "Search not found" }, { status: 404 });
  }

  const { query, mode } = searchParams;

  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;

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
      // Client disconnected
      controllerRef = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
