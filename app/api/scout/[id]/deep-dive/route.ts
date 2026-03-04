import { NextRequest, NextResponse } from "next/server";
import { createServerClient, getSessionUserIdFromAuth } from "@/lib/supabase";
import { createAuthServerClient } from "@/lib/supabase/server";
import {
  analyzeRepo,
  buildSummaryPrompt,
  parseSummary,
  buildFallbackResult,
} from "@/lib/deep-dive-analyzer";
import { extractJSON } from "@/lib/text-utils";
import { callLLMWithTools } from "@/lib/llm";
import type { DeepDiveResult, ScoutSummary } from "@/lib/types";

import { sseEncode, SSE_HEADERS } from "@/lib/sse";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing search ID" }, { status: 400 });
  }

  // Verify the search belongs to the requesting user
  const authClient = await createAuthServerClient();
  const { userId } = await getSessionUserIdFromAuth(request, authClient);
  const db = createServerClient();
  const { data: search } = await db
    .from("searches")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!search) {
    return NextResponse.json({ error: "Search not found" }, { status: 404 });
  }

  let body: { repo_urls?: string[]; precomputed_results?: DeepDiveResult[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const repo_urls: string[] = Array.isArray(body.repo_urls)
    ? body.repo_urls
    : [];
  const precomputed: DeepDiveResult[] = Array.isArray(body.precomputed_results)
    ? body.precomputed_results
    : [];

  // Cap repo_urls to prevent abuse
  if (repo_urls.length > 10) {
    return NextResponse.json(
      { error: "Maximum 10 repo_urls allowed" },
      { status: 400 }
    );
  }

  // Must have something to work with
  if (repo_urls.length === 0 && precomputed.length === 0) {
    return NextResponse.json(
      { error: "repo_urls or precomputed_results required" },
      { status: 400 }
    );
  }

  // Validate GitHub URLs
  for (const url of repo_urls) {
    if (typeof url !== "string" || !url.startsWith("https://github.com/")) {
      return NextResponse.json(
        { error: `Invalid GitHub URL: ${url}` },
        { status: 400 }
      );
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
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
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }

      (async () => {
        // Collect all results: pre-computed ones first, then newly analyzed
        const allResults: DeepDiveResult[] = [...precomputed];

        // Emit pre-computed results immediately so client sees them
        for (const result of precomputed) {
          send("deep_dive_complete", result);
        }

        // Analyze any missing repos in parallel
        if (repo_urls.length > 0) {
          const totalToAnalyze = repo_urls.length;

          const results = await Promise.allSettled(
            repo_urls.map((url, i) => {
              send("deep_dive_start", {
                repo_url: url,
                index: precomputed.length + i,
                total: precomputed.length + totalToAnalyze,
              });

              return analyzeRepo(url, id, {
                onToolCall(toolName, args) {
                  if (toolName === "web_fetch" || toolName === "web_search") {
                    send("deep_dive_section", {
                      repo_url: url,
                      section:
                        toolName === "web_fetch" ? "fetching" : "searching",
                      content:
                        toolName === "web_fetch"
                          ? `Fetching ${args.url as string}`
                          : `Searching: ${args.query as string}`,
                    });
                  }
                },
              }).then((result) => {
                send("deep_dive_complete", result);
                return result;
              }).catch((err) => {
                const fallback = buildFallbackResult(url);
                send("deep_dive_complete", fallback);
                send("error", {
                  message: `Failed to analyze ${url}: ${err instanceof Error ? err.message : "Unknown error"}`,
                  recoverable: true,
                });
                return fallback;
              });
            })
          );

          for (const result of results) {
            if (result.status === "fulfilled") {
              allResults.push(result.value);
            }
          }
        }

        // Generate summary across all repos
        try {
          const summarySystemPrompt = buildSummaryPrompt(allResults);
          const summaryUserMessage = `Generate a comprehensive summary and recommendations based on the ${allResults.length} repositories analyzed above. Return the structured JSON summary.`;

          const summaryResponse = await callLLMWithTools({
            systemPrompt: summarySystemPrompt,
            userMessage: summaryUserMessage,
            maxToolRounds: 2,
          });

          const summaryJsonStr = extractJSON(summaryResponse);
          const summaryParsed = JSON.parse(summaryJsonStr) as Record<
            string,
            unknown
          >;
          const summary = parseSummary(summaryParsed);

          send("summary", summary);
        } catch {
          const fallbackSummary: ScoutSummary = {
            takeaways: [`Analyzed ${allResults.length} repositories.`],
            recommendations: {},
            skills_roadmap: [],
            gaps_discovered: [],
            ai_ecosystem_notes:
              "Summary generation failed. Review individual repo analyses above.",
          };
          send("summary", fallbackSummary);
        }

        // Mark phase2 complete
        try {
          const db = createServerClient();
          const { error: p2Error } = await db
            .from("searches")
            .update({ phase2_complete: true })
            .eq("id", id);

          if (p2Error) {
            console.error("Phase2 complete persist error:", p2Error);
          }
        } catch (e) {
          console.error("Phase2 complete persist error:", e);
        }

        safeClose();
      })().catch((err) => {
        send("error", {
          message: err instanceof Error ? err.message : "Deep dive failed",
          recoverable: true,
        });
        safeClose();
      });
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
