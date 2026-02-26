import { NextRequest, NextResponse } from "next/server";
import { callLLMWithTools } from "@/lib/llm";
import { createServerClient, getSessionUserId } from "@/lib/supabase";
import type {
  DeepDiveResult,
  DeepDiveSection,
  AIPatterns,
  ScoutSummary,
} from "@/lib/types";

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function buildDeepDivePrompt(repoUrl: string): string {
  return `You are GitHub Scout's Deep Dive analyzer. Your job is to perform an in-depth analysis of a single GitHub repository.

## Target Repository
${repoUrl}

## Your Tools
- web_search: Search the web for information about this repo
- web_fetch: Fetch web pages to extract real data

## Analysis Workflow

1. **Fetch the GitHub repo page**: Use web_fetch on "${repoUrl}" to get real metadata (stars, language, license, last updated, contributors count)
2. **Fetch the README**: Use web_fetch on "${repoUrl}/blob/main/README.md" or "${repoUrl}#readme" to understand what the project does
3. **Check package files**: Search for dependency information — look for package.json, requirements.txt, Cargo.toml, go.mod, etc.
4. **Detect AI patterns**: Search for these indicators in the repo:
   - Directories: .cursor/, .claude/, skills/, mcp/, agents/
   - Dependencies: langchain, llamaindex, openai, anthropic, crewai, autogen
   - Files: .cursorrules, .claude, mcp.json, skills.yaml
5. **Search for community context**: Search "{repo_name} architecture" or "{repo_name} review" for external insights

## Architecture Pattern Classification
Identify which pattern the repo follows:
- **monolithic_agent**: Single AI agent handling everything
- **multi_agent**: Multiple specialized agents collaborating
- **tool_calling**: Agent with tool/function calling capabilities
- **rag**: Retrieval-Augmented Generation pattern
- **workflow**: Orchestrated multi-step pipeline
- **library**: Reusable SDK/library (not an agent itself)
- **none**: No AI/agent architecture detected

## Output Format

Return a JSON object with this EXACT structure (no markdown fences, no extra text):
{
  "repo_url": "${repoUrl}",
  "repo_name": "owner/repo",
  "stars": 0,
  "contributors": null,
  "license": "MIT",
  "primary_language": "TypeScript",
  "last_updated": "2026-01-15",
  "what_it_does": {
    "title": "What It Does",
    "content": "2-3 sentence description of the project's purpose and functionality",
    "confidence": "high",
    "source": "readme"
  },
  "why_it_stands_out": {
    "title": "Why It Stands Out",
    "content": "What makes this repo notable compared to alternatives",
    "confidence": "high",
    "source": "analysis"
  },
  "tech_stack": {
    "languages": ["TypeScript", "Python"],
    "frameworks": ["Next.js", "FastAPI"],
    "infrastructure": ["Docker", "AWS"],
    "key_dependencies": ["openai", "langchain"],
    "confidence": "high"
  },
  "architecture": {
    "title": "Architecture",
    "content": "Description of the project's architecture and design patterns",
    "confidence": "medium",
    "source": "code_analysis"
  },
  "ai_patterns": {
    "has_ai_components": true,
    "sdks_detected": ["openai", "langchain"],
    "agent_architecture": "tool_calling",
    "skill_files": [".cursorrules"],
    "mcp_usage": false,
    "prompt_engineering": {
      "has_system_prompts": true,
      "has_few_shot": false,
      "prompt_location": "src/prompts/"
    },
    "confidence": "high",
    "summary": "Brief summary of AI usage patterns"
  },
  "skills_required": {
    "technical": ["TypeScript", "React", "Node.js"],
    "design": ["API Design", "System Architecture"],
    "domain": ["Machine Learning", "NLP"]
  },
  "mode_specific": {
    "title": "Key Insights",
    "content": "Mode-relevant insights about this repository",
    "confidence": "medium",
    "source": "analysis"
  }
}

IMPORTANT:
- Return ONLY the JSON object, no markdown code fences, no extra text
- Use real data from your fetches — do NOT fabricate stars, language, or other metadata
- If you cannot determine a value, use null or "unknown" as appropriate
- Be thorough but accurate — mark confidence as "low" when guessing`;
}

function buildSummaryPrompt(results: DeepDiveResult[]): string {
  const repoSummaries = results.map((r) => ({
    name: r.repo_name,
    url: r.repo_url,
    stars: r.stars,
    what: r.what_it_does.content,
    stack: r.tech_stack,
    ai: r.ai_patterns.summary,
    architecture: r.architecture.content,
  }));

  return `You are GitHub Scout's summary analyst. You have just analyzed ${results.length} repositories in depth. Based on the analysis results below, generate a comprehensive summary.

## Analyzed Repositories
${JSON.stringify(repoSummaries, null, 2)}

## Output Format

Return a JSON object with this EXACT structure (no markdown fences, no extra text):
{
  "takeaways": [
    "Key takeaway 1 about the ecosystem",
    "Key takeaway 2 about trends",
    "Key takeaway 3 about opportunities"
  ],
  "recommendations": {
    "learning": { "repo": "owner/repo", "reason": "Why this is best for learning" },
    "building": { "repo": "owner/repo", "reason": "Why this is best as a foundation" },
    "scouting": { "insight": "Key competitive/market insight from this analysis" }
  },
  "skills_roadmap": [
    "Skill 1 to learn first",
    "Skill 2 to learn next",
    "Skill 3 for advanced usage"
  ],
  "gaps_discovered": [
    "Gap 1 in the ecosystem",
    "Gap 2 that could be filled"
  ],
  "ai_ecosystem_notes": "Summary of AI/agent patterns observed across all repos, including SDK usage trends, architecture patterns, and emerging practices"
}

IMPORTANT:
- Return ONLY the JSON object, no markdown code fences, no extra text
- Reference specific repos by name in recommendations
- Be specific and actionable in the skills roadmap
- Identify real gaps, not generic observations`;
}

const defaultSection: DeepDiveSection = {
  title: "Unknown",
  content: "Analysis could not determine this section.",
  confidence: "low",
};

const defaultAIPatterns: AIPatterns = {
  has_ai_components: false,
  sdks_detected: [],
  agent_architecture: null,
  skill_files: [],
  mcp_usage: false,
  prompt_engineering: {
    has_system_prompts: false,
    has_few_shot: false,
    prompt_location: null,
  },
  confidence: "low",
  summary: "Could not determine AI patterns.",
};

function parseSection(raw: unknown): DeepDiveSection {
  if (!raw || typeof raw !== "object") return { ...defaultSection };
  const obj = raw as Record<string, unknown>;
  return {
    title: (typeof obj.title === "string" ? obj.title : defaultSection.title),
    content: (typeof obj.content === "string" ? obj.content : defaultSection.content),
    confidence: (["high", "medium", "low"].includes(obj.confidence as string)
      ? (obj.confidence as "high" | "medium" | "low")
      : "low"),
    source: typeof obj.source === "string" ? obj.source : undefined,
  };
}

function parseAIPatterns(raw: unknown): AIPatterns {
  if (!raw || typeof raw !== "object") return { ...defaultAIPatterns };
  const obj = raw as Record<string, unknown>;
  const promptEng = obj.prompt_engineering as Record<string, unknown> | undefined;

  return {
    has_ai_components: typeof obj.has_ai_components === "boolean" ? obj.has_ai_components : false,
    sdks_detected: Array.isArray(obj.sdks_detected) ? obj.sdks_detected.filter((s): s is string => typeof s === "string") : [],
    agent_architecture: typeof obj.agent_architecture === "string" ? obj.agent_architecture : null,
    skill_files: Array.isArray(obj.skill_files) ? obj.skill_files.filter((s): s is string => typeof s === "string") : [],
    mcp_usage: typeof obj.mcp_usage === "boolean" ? obj.mcp_usage : false,
    prompt_engineering: {
      has_system_prompts: promptEng && typeof promptEng.has_system_prompts === "boolean" ? promptEng.has_system_prompts : false,
      has_few_shot: promptEng && typeof promptEng.has_few_shot === "boolean" ? promptEng.has_few_shot : false,
      prompt_location: promptEng && typeof promptEng.prompt_location === "string" ? promptEng.prompt_location : null,
    },
    confidence: (["high", "medium", "low"].includes(obj.confidence as string)
      ? (obj.confidence as "high" | "medium" | "low")
      : "low"),
    summary: typeof obj.summary === "string" ? obj.summary : "Could not determine AI patterns.",
  };
}

function parseDeepDiveResult(raw: Record<string, unknown>, repoUrl: string): DeepDiveResult {
  const techStack = raw.tech_stack as Record<string, unknown> | undefined;
  const skillsRequired = raw.skills_required as Record<string, unknown> | undefined;

  return {
    repo_url: typeof raw.repo_url === "string" ? raw.repo_url : repoUrl,
    repo_name: typeof raw.repo_name === "string" ? raw.repo_name : repoUrl.replace("https://github.com/", ""),
    stars: typeof raw.stars === "number" ? raw.stars : 0,
    contributors: typeof raw.contributors === "number" ? raw.contributors : null,
    license: typeof raw.license === "string" ? raw.license : "Unknown",
    primary_language: typeof raw.primary_language === "string" ? raw.primary_language : "Unknown",
    last_updated: typeof raw.last_updated === "string" ? raw.last_updated : new Date().toISOString().split("T")[0],
    what_it_does: parseSection(raw.what_it_does),
    why_it_stands_out: parseSection(raw.why_it_stands_out),
    tech_stack: {
      languages: techStack && Array.isArray(techStack.languages)
        ? techStack.languages.filter((s): s is string => typeof s === "string")
        : [],
      frameworks: techStack && Array.isArray(techStack.frameworks)
        ? techStack.frameworks.filter((s): s is string => typeof s === "string")
        : [],
      infrastructure: techStack && Array.isArray(techStack.infrastructure)
        ? techStack.infrastructure.filter((s): s is string => typeof s === "string")
        : [],
      key_dependencies: techStack && Array.isArray(techStack.key_dependencies)
        ? techStack.key_dependencies.filter((s): s is string => typeof s === "string")
        : [],
      confidence: (techStack && ["high", "medium", "low"].includes(techStack.confidence as string)
        ? (techStack.confidence as "high" | "medium" | "low")
        : "low"),
    },
    architecture: parseSection(raw.architecture),
    ai_patterns: parseAIPatterns(raw.ai_patterns),
    skills_required: {
      technical: skillsRequired && Array.isArray(skillsRequired.technical)
        ? skillsRequired.technical.filter((s): s is string => typeof s === "string")
        : [],
      design: skillsRequired && Array.isArray(skillsRequired.design)
        ? skillsRequired.design.filter((s): s is string => typeof s === "string")
        : [],
      domain: skillsRequired && Array.isArray(skillsRequired.domain)
        ? skillsRequired.domain.filter((s): s is string => typeof s === "string")
        : [],
    },
    mode_specific: parseSection(raw.mode_specific),
  };
}

function parseSummary(raw: Record<string, unknown>): ScoutSummary {
  const recs = raw.recommendations as Record<string, unknown> | undefined;
  const learning = recs?.learning as Record<string, unknown> | undefined;
  const building = recs?.building as Record<string, unknown> | undefined;
  const scouting = recs?.scouting as Record<string, unknown> | undefined;

  return {
    takeaways: Array.isArray(raw.takeaways)
      ? raw.takeaways.filter((s): s is string => typeof s === "string")
      : [],
    recommendations: {
      learning: learning && typeof learning.repo === "string" && typeof learning.reason === "string"
        ? { repo: learning.repo, reason: learning.reason }
        : undefined,
      building: building && typeof building.repo === "string" && typeof building.reason === "string"
        ? { repo: building.repo, reason: building.reason }
        : undefined,
      scouting: scouting && typeof scouting.insight === "string"
        ? { insight: scouting.insight }
        : undefined,
    },
    skills_roadmap: Array.isArray(raw.skills_roadmap)
      ? raw.skills_roadmap.filter((s): s is string => typeof s === "string")
      : [],
    gaps_discovered: Array.isArray(raw.gaps_discovered)
      ? raw.gaps_discovered.filter((s): s is string => typeof s === "string")
      : [],
    ai_ecosystem_notes: typeof raw.ai_ecosystem_notes === "string"
      ? raw.ai_ecosystem_notes
      : "",
  };
}

function extractJSON(text: string): string {
  // Try to extract JSON from markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  // Try to extract raw JSON object
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    return braceMatch[0];
  }
  return text;
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

  let body: { repo_urls?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!Array.isArray(body.repo_urls) || body.repo_urls.length === 0) {
    return NextResponse.json(
      { error: "repo_urls must be a non-empty array" },
      { status: 400 }
    );
  }

  if (body.repo_urls.length > 5) {
    return NextResponse.json(
      { error: "Maximum 5 repositories allowed for deep dive" },
      { status: 400 }
    );
  }

  // Validate that all URLs look like GitHub URLs
  for (const url of body.repo_urls) {
    if (typeof url !== "string" || !url.startsWith("https://github.com/")) {
      return NextResponse.json(
        { error: `Invalid GitHub URL: ${url}` },
        { status: 400 }
      );
    }
  }

  const repo_urls: string[] = body.repo_urls;

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
          try { controller.close(); } catch { /* already closed */ }
        }
      }

      const deepDiveResults: DeepDiveResult[] = [];

      (async () => {

        // Analyze a single repo — returns result or fallback
        async function analyzeRepo(repoUrl: string, index: number): Promise<DeepDiveResult> {
          send("deep_dive_start", {
            repo_url: repoUrl,
            index,
            total: repo_urls.length,
          });

          try {
            const systemPrompt = buildDeepDivePrompt(repoUrl);
            const userMessage = `Analyze this repository in depth: ${repoUrl}

Fetch the repo page, read the README, check dependencies, and identify AI patterns. Return the structured JSON analysis.`;

            const finalResponse = await callLLMWithTools({
              systemPrompt,
              userMessage,
              onToolCall(toolName, args) {
                if (toolName === "web_fetch" || toolName === "web_search") {
                  send("deep_dive_section", {
                    repo_url: repoUrl,
                    section: toolName === "web_fetch" ? "fetching" : "searching",
                    content: toolName === "web_fetch"
                      ? `Fetching ${args.url as string}`
                      : `Searching: ${args.query as string}`,
                  });
                }
              },
              maxToolRounds: 5,
            });

            // Parse the LLM response
            const jsonStr = extractJSON(finalResponse);
            const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
            const result = parseDeepDiveResult(parsed, repoUrl);

            send("deep_dive_complete", result);

            // Persist deep dive to Supabase
            try {
              const db = createServerClient();
              const { data: updated, error: upsertError } = await db
                .from("search_results")
                .update({ deep_dive: result })
                .eq("search_id", id)
                .eq("repo_url", repoUrl)
                .select("id");

              if (upsertError) {
                console.error("Failed to save deep dive:", upsertError);
              } else if (!updated || updated.length === 0) {
                console.warn(`Deep dive update matched 0 rows for search_id=${id}, repo_url=${repoUrl}`);
              }
            } catch (e) {
              console.error("Deep dive persist error:", e);
            }

            return result;
          } catch (err) {
            // If a single repo fails, create a minimal result
            const fallbackResult: DeepDiveResult = {
              repo_url: repoUrl,
              repo_name: repoUrl.replace("https://github.com/", ""),
              stars: 0,
              contributors: null,
              license: "Unknown",
              primary_language: "Unknown",
              last_updated: new Date().toISOString().split("T")[0],
              what_it_does: {
                title: "What It Does",
                content: "Analysis failed for this repository.",
                confidence: "low",
              },
              why_it_stands_out: { ...defaultSection, title: "Why It Stands Out" },
              tech_stack: {
                languages: [],
                frameworks: [],
                infrastructure: [],
                key_dependencies: [],
                confidence: "low",
              },
              architecture: { ...defaultSection, title: "Architecture" },
              ai_patterns: { ...defaultAIPatterns },
              skills_required: { technical: [], design: [], domain: [] },
              mode_specific: { ...defaultSection, title: "Key Insights" },
            };

            send("deep_dive_complete", fallbackResult);

            // Persist fallback deep dive to Supabase
            try {
              const db = createServerClient();
              const { data: updated, error: fallbackError } = await db
                .from("search_results")
                .update({ deep_dive: fallbackResult })
                .eq("search_id", id)
                .eq("repo_url", repoUrl)
                .select("id");

              if (fallbackError) {
                console.error("Failed to save fallback deep dive:", fallbackError);
              } else if (!updated || updated.length === 0) {
                console.warn(`Fallback deep dive update matched 0 rows for search_id=${id}, repo_url=${repoUrl}`);
              }
            } catch (e) {
              console.error("Fallback deep dive persist error:", e);
            }

            send("error", {
              message: `Failed to analyze ${repoUrl}: ${err instanceof Error ? err.message : "Unknown error"}`,
              recoverable: true,
            });

            return fallbackResult;
          }
        }

        // Process repos in parallel (all at once — each is an independent LLM call)
        const results = await Promise.allSettled(
          repo_urls.map((url, i) => analyzeRepo(url, i))
        );

        for (const result of results) {
          if (result.status === "fulfilled") {
            deepDiveResults.push(result.value);
          }
        }

        // Generate summary across all repos
        try {
          const summarySystemPrompt = buildSummaryPrompt(deepDiveResults);
          const summaryUserMessage = `Generate a comprehensive summary and recommendations based on the ${deepDiveResults.length} repositories analyzed above. Return the structured JSON summary.`;

          const summaryResponse = await callLLMWithTools({
            systemPrompt: summarySystemPrompt,
            userMessage: summaryUserMessage,
            maxToolRounds: 2,
          });

          const summaryJsonStr = extractJSON(summaryResponse);
          const summaryParsed = JSON.parse(summaryJsonStr) as Record<string, unknown>;
          const summary = parseSummary(summaryParsed);

          send("summary", summary);

            // Mark phase2 complete in Supabase
            try {
              const db = createServerClient();
              const { data: updated, error: p2Error } = await db
                .from("searches")
                .update({ phase2_complete: true })
                .eq("id", id)
                .select("id");

              if (p2Error) {
                console.error("Phase2 complete persist error:", p2Error);
              } else if (!updated || updated.length === 0) {
                console.warn(`Phase2 complete update matched 0 rows for search id=${id}`);
              }
            } catch (e) {
              console.error("Phase2 complete persist error:", e);
            }
        } catch {
          // Provide a minimal summary if generation fails
          const fallbackSummary: ScoutSummary = {
            takeaways: [`Analyzed ${deepDiveResults.length} repositories.`],
            recommendations: {},
            skills_roadmap: [],
            gaps_discovered: [],
            ai_ecosystem_notes: "Summary generation failed. Review individual repo analyses above.",
          };
          send("summary", fallbackSummary);

            try {
              const db = createServerClient();
              const { data: updated, error: p2Error } = await db
                .from("searches")
                .update({ phase2_complete: true })
                .eq("id", id)
                .select("id");

              if (p2Error) {
                console.error("Phase2 fallback complete persist error:", p2Error);
              } else if (!updated || updated.length === 0) {
                console.warn(`Phase2 fallback complete update matched 0 rows for search id=${id}`);
              }
            } catch (e) {
              console.error("Phase2 complete persist error:", e);
            }
        }

        safeClose();
      })().catch((err) => {
        // If we already have some results, send a fallback summary first
        if (deepDiveResults.length > 0) {
          send("summary", {
            takeaways: [`Partially analyzed ${deepDiveResults.length} repositories before an error occurred.`],
            recommendations: {},
            skills_roadmap: [],
            gaps_discovered: [],
            ai_ecosystem_notes: "Analysis was interrupted. Review individual repo analyses above.",
          });
        }
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
