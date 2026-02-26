import { NextRequest, NextResponse } from "next/server";
import { createServerClient, getSessionUserId } from "@/lib/supabase";
import {
  analyzeRepoV2,
  buildSummaryPromptV2,
  parseSummaryV2,
  buildFallbackResultV2,
} from "@/lib/deep-dive-analyzer-v2";
import { callLLMWithTools } from "@/lib/llm";
import { extractJSON } from "@/lib/deep-dive-analyzer";
import type { DeepDiveResultV2, ScoutSummaryV2 } from "@/lib/types";

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing search ID" }, { status: 400 });
  }

  // Verify the search belongs to the requesting user
  const userId = getSessionUserId(request);
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

  let body: { repo_urls?: string[]; precomputed_results?: DeepDiveResultV2[] };
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
  const precomputed: DeepDiveResultV2[] = Array.isArray(
    body.precomputed_results
  )
    ? body.precomputed_results
    : [];

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
        const allResults: DeepDiveResultV2[] = [...precomputed];

        // Emit pre-computed results immediately so client sees them
        for (const result of precomputed) {
          send("deep_dive_complete_v2", result);
        }

        // Analyze any missing repos in parallel
        if (repo_urls.length > 0) {
          const totalToAnalyze = repo_urls.length;

          const results = await Promise.allSettled(
            repo_urls.map((url, i) => {
              send("deep_dive_fetch_start", {
                repo_url: url,
                index: precomputed.length + i,
                total: precomputed.length + totalToAnalyze,
              });

              send("deep_dive_analyze_start", {
                repo_url: url,
                index: precomputed.length + i,
                total: precomputed.length + totalToAnalyze,
              });

              return analyzeRepoV2(url, id)
                .then((result) => {
                  send("deep_dive_complete_v2", result);
                  return result;
                })
                .catch((err) => {
                  const fallback = buildFallbackResultV2(url);
                  send("deep_dive_complete_v2", fallback);
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

        // Generate V2 summary across all repos
        try {
          const { systemPrompt, userMessage } =
            buildSummaryPromptV2(allResults);

          const summaryResponse = await callLLMWithTools({
            systemPrompt,
            userMessage,
            maxToolRounds: 0,
          });

          const summaryJsonStr = extractJSON(summaryResponse);
          const summaryParsed = JSON.parse(summaryJsonStr) as Record<
            string,
            unknown
          >;
          const summary: ScoutSummaryV2 = parseSummaryV2(summaryParsed);

          send("summary_v2", summary);
        } catch {
          const fallbackSummary: ScoutSummaryV2 = {
            takeaways: [`Analyzed ${allResults.length} repositories.`],
            recommendation: {
              repo: "",
              repo_url: "",
              reason:
                "Summary generation failed. Review individual repo analyses above.",
              mode: "scout",
            },
            comparative_matrix: { dimensions: [], repos: [] },
            skills_roadmap: [],
            ecosystem_gaps: [],
            ai_ecosystem_notes:
              "Summary generation failed. Review individual repo analyses above.",
          };
          send("summary_v2", fallbackSummary);
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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
