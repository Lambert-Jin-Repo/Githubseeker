/**
 * Scout result parser — extracts prompt builders and LLM response parsing
 * from the main scout route handler to improve separation of concerns.
 */

import { normalizeGitHubUrl } from "@/lib/url-normalize";
import type {
  ScoutMode,
  RepoResult,
  RepoVerification,
  QualityTier,
  RedditSignal,
} from "@/lib/types";

// ── System prompt builder ────────────────────────────────────────

export function buildSystemPrompt(mode: ScoutMode, isVagueQuery: boolean): string {
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

// ── User message builder ─────────────────────────────────────────

export function buildUserMessage(query: string, mode: ScoutMode): string {
  return `Search for: "${query}"

Mode: ${mode}
${mode === "LEARN" ? "Focus on repos with good documentation, tutorials, and beginner-friendly codebases." : ""}
${mode === "BUILD" ? "Focus on repos with production-ready templates, good architecture, and active maintenance." : ""}
${mode === "SCOUT" ? "Focus on the competitive landscape, alternatives, and emerging tools in this space." : ""}

Execute all search strategies, verify each repo, and return the structured JSON result.`;
}

// ── Repo result parser ───────────────────────────────────────────

export function parseRepoFromRaw(raw: Record<string, unknown>): RepoResult {
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
