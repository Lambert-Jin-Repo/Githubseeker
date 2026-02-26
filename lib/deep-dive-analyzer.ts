import { callLLMWithTools } from "@/lib/llm";
import { createServerClient } from "@/lib/supabase";
import type {
  DeepDiveResult,
  DeepDiveSection,
  AIPatterns,
  ScoutSummary,
} from "@/lib/types";

// ── Prompt builders ──────────────────────────────────────────────

export function buildDeepDivePrompt(repoUrl: string): string {
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

export function buildSummaryPrompt(results: DeepDiveResult[]): string {
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

// ── Default values ───────────────────────────────────────────────

export const defaultSection: DeepDiveSection = {
  title: "Unknown",
  content: "Analysis could not determine this section.",
  confidence: "low",
};

export const defaultAIPatterns: AIPatterns = {
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

// ── Parsers ──────────────────────────────────────────────────────

export function parseSection(raw: unknown): DeepDiveSection {
  if (!raw || typeof raw !== "object") return { ...defaultSection };
  const obj = raw as Record<string, unknown>;
  return {
    title: typeof obj.title === "string" ? obj.title : defaultSection.title,
    content:
      typeof obj.content === "string" ? obj.content : defaultSection.content,
    confidence: ["high", "medium", "low"].includes(obj.confidence as string)
      ? (obj.confidence as "high" | "medium" | "low")
      : "low",
    source: typeof obj.source === "string" ? obj.source : undefined,
  };
}

export function parseAIPatterns(raw: unknown): AIPatterns {
  if (!raw || typeof raw !== "object") return { ...defaultAIPatterns };
  const obj = raw as Record<string, unknown>;
  const promptEng = obj.prompt_engineering as
    | Record<string, unknown>
    | undefined;

  return {
    has_ai_components:
      typeof obj.has_ai_components === "boolean"
        ? obj.has_ai_components
        : false,
    sdks_detected: Array.isArray(obj.sdks_detected)
      ? obj.sdks_detected.filter((s): s is string => typeof s === "string")
      : [],
    agent_architecture:
      typeof obj.agent_architecture === "string"
        ? obj.agent_architecture
        : null,
    skill_files: Array.isArray(obj.skill_files)
      ? obj.skill_files.filter((s): s is string => typeof s === "string")
      : [],
    mcp_usage: typeof obj.mcp_usage === "boolean" ? obj.mcp_usage : false,
    prompt_engineering: {
      has_system_prompts:
        promptEng && typeof promptEng.has_system_prompts === "boolean"
          ? promptEng.has_system_prompts
          : false,
      has_few_shot:
        promptEng && typeof promptEng.has_few_shot === "boolean"
          ? promptEng.has_few_shot
          : false,
      prompt_location:
        promptEng && typeof promptEng.prompt_location === "string"
          ? promptEng.prompt_location
          : null,
    },
    confidence: ["high", "medium", "low"].includes(obj.confidence as string)
      ? (obj.confidence as "high" | "medium" | "low")
      : "low",
    summary:
      typeof obj.summary === "string"
        ? obj.summary
        : "Could not determine AI patterns.",
  };
}

export function parseDeepDiveResult(
  raw: Record<string, unknown>,
  repoUrl: string
): DeepDiveResult {
  const techStack = raw.tech_stack as Record<string, unknown> | undefined;
  const skillsRequired = raw.skills_required as
    | Record<string, unknown>
    | undefined;

  return {
    repo_url: typeof raw.repo_url === "string" ? raw.repo_url : repoUrl,
    repo_name:
      typeof raw.repo_name === "string"
        ? raw.repo_name
        : repoUrl.replace("https://github.com/", ""),
    stars: typeof raw.stars === "number" ? raw.stars : 0,
    contributors:
      typeof raw.contributors === "number" ? raw.contributors : null,
    license: typeof raw.license === "string" ? raw.license : "Unknown",
    primary_language:
      typeof raw.primary_language === "string"
        ? raw.primary_language
        : "Unknown",
    last_updated:
      typeof raw.last_updated === "string"
        ? raw.last_updated
        : new Date().toISOString().split("T")[0],
    what_it_does: parseSection(raw.what_it_does),
    why_it_stands_out: parseSection(raw.why_it_stands_out),
    tech_stack: {
      languages:
        techStack && Array.isArray(techStack.languages)
          ? techStack.languages.filter(
              (s): s is string => typeof s === "string"
            )
          : [],
      frameworks:
        techStack && Array.isArray(techStack.frameworks)
          ? techStack.frameworks.filter(
              (s): s is string => typeof s === "string"
            )
          : [],
      infrastructure:
        techStack && Array.isArray(techStack.infrastructure)
          ? techStack.infrastructure.filter(
              (s): s is string => typeof s === "string"
            )
          : [],
      key_dependencies:
        techStack && Array.isArray(techStack.key_dependencies)
          ? techStack.key_dependencies.filter(
              (s): s is string => typeof s === "string"
            )
          : [],
      confidence:
        techStack &&
        ["high", "medium", "low"].includes(techStack.confidence as string)
          ? (techStack.confidence as "high" | "medium" | "low")
          : "low",
    },
    architecture: parseSection(raw.architecture),
    ai_patterns: parseAIPatterns(raw.ai_patterns),
    skills_required: {
      technical:
        skillsRequired && Array.isArray(skillsRequired.technical)
          ? skillsRequired.technical.filter(
              (s): s is string => typeof s === "string"
            )
          : [],
      design:
        skillsRequired && Array.isArray(skillsRequired.design)
          ? skillsRequired.design.filter(
              (s): s is string => typeof s === "string"
            )
          : [],
      domain:
        skillsRequired && Array.isArray(skillsRequired.domain)
          ? skillsRequired.domain.filter(
              (s): s is string => typeof s === "string"
            )
          : [],
    },
    mode_specific: parseSection(raw.mode_specific),
  };
}

export function parseSummary(raw: Record<string, unknown>): ScoutSummary {
  const recs = raw.recommendations as Record<string, unknown> | undefined;
  const learning = recs?.learning as Record<string, unknown> | undefined;
  const building = recs?.building as Record<string, unknown> | undefined;
  const scouting = recs?.scouting as Record<string, unknown> | undefined;

  return {
    takeaways: Array.isArray(raw.takeaways)
      ? raw.takeaways.filter((s): s is string => typeof s === "string")
      : [],
    recommendations: {
      learning:
        learning &&
        typeof learning.repo === "string" &&
        typeof learning.reason === "string"
          ? { repo: learning.repo, reason: learning.reason }
          : undefined,
      building:
        building &&
        typeof building.repo === "string" &&
        typeof building.reason === "string"
          ? { repo: building.repo, reason: building.reason }
          : undefined,
      scouting:
        scouting && typeof scouting.insight === "string"
          ? { insight: scouting.insight }
          : undefined,
    },
    skills_roadmap: Array.isArray(raw.skills_roadmap)
      ? raw.skills_roadmap.filter((s): s is string => typeof s === "string")
      : [],
    gaps_discovered: Array.isArray(raw.gaps_discovered)
      ? raw.gaps_discovered.filter((s): s is string => typeof s === "string")
      : [],
    ai_ecosystem_notes:
      typeof raw.ai_ecosystem_notes === "string"
        ? raw.ai_ecosystem_notes
        : "",
  };
}

export function extractJSON(text: string): string {
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

// ── Fallback builder ─────────────────────────────────────────────

export function buildFallbackResult(repoUrl: string): DeepDiveResult {
  return {
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
}

// ── Core analysis function ───────────────────────────────────────

export interface AnalyzeRepoOptions {
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
}

/**
 * Analyzes a single GitHub repo: runs the LLM agentic loop, parses the
 * result, persists to Supabase, and returns the typed DeepDiveResult.
 * On failure, persists and returns a fallback result.
 */
export async function analyzeRepo(
  repoUrl: string,
  searchId: string,
  options?: AnalyzeRepoOptions
): Promise<DeepDiveResult> {
  try {
    const systemPrompt = buildDeepDivePrompt(repoUrl);
    const userMessage = `Analyze this repository in depth: ${repoUrl}

Fetch the repo page, read the README, check dependencies, and identify AI patterns. Return the structured JSON analysis.`;

    const finalResponse = await callLLMWithTools({
      systemPrompt,
      userMessage,
      onToolCall: options?.onToolCall,
      maxToolRounds: 5,
    });

    const jsonStr = extractJSON(finalResponse);
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const result = parseDeepDiveResult(parsed, repoUrl);

    // Persist to Supabase
    await persistDeepDive(searchId, repoUrl, result);

    return result;
  } catch (err) {
    console.error(
      `[deep-dive-analyzer] Failed to analyze ${repoUrl}:`,
      err instanceof Error ? err.message : err
    );
    const fallback = buildFallbackResult(repoUrl);

    // Persist fallback
    await persistDeepDive(searchId, repoUrl, fallback);

    return fallback;
  }
}

// ── Persistence helper ───────────────────────────────────────────

async function persistDeepDive(
  searchId: string,
  repoUrl: string,
  result: DeepDiveResult
): Promise<void> {
  try {
    const db = createServerClient();
    const { data: updated, error } = await db
      .from("search_results")
      .update({ deep_dive: result })
      .eq("search_id", searchId)
      .eq("repo_url", repoUrl)
      .select("id");

    if (error) {
      console.error("[deep-dive-analyzer] Persist error:", error);
    } else if (!updated || updated.length === 0) {
      console.warn(
        `[deep-dive-analyzer] Update matched 0 rows for search_id=${searchId}, repo_url=${repoUrl}`
      );
    }
  } catch (e) {
    console.error("[deep-dive-analyzer] Persist exception:", e);
  }
}
