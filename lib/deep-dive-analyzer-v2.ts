/**
 * V2 Deep-Dive Analyzer — orchestrates parallel LLM analysis of GitHub repos.
 *
 * All parsing, prompt building, and ecosystem search logic has been extracted to:
 *   - lib/deep-dive/parsers.ts   — defensive JSON response parsing
 *   - lib/deep-dive/prompts.ts   — LLM prompt construction
 *   - lib/deep-dive/ecosystem.ts — agent file discovery via web search
 *
 * This file retains only the orchestration functions and re-exports everything
 * for backwards compatibility.
 */

import { callLLMWithTools } from "@/lib/llm";
import { fetchRepoData, fetchAllReposData } from "@/lib/repo-data-fetcher";
import type { RawRepoData } from "@/lib/repo-data-fetcher";
import { persistDeepDive } from "@/lib/persistence";
import type { DeepDiveResultV2, EnhancedSection } from "@/lib/types";

// Re-export sub-modules for backwards compatibility
export {
  parseSources,
  parseConfidence,
  parseStringArray,
  safeParseJSON,
  parseEnhancedSection,
  parseCodeQuality,
  parseCommunityHealth,
  parseDocumentationQuality,
  parseSecurityPosture,
  parseGettingStarted,
  parseAIPatternsV2,
  parseAgentEcosystem,
  parseSummaryV2,
} from "@/lib/deep-dive/parsers";

export {
  buildDataContext,
  buildGroupAPrompt,
  buildGroupBPrompt,
  buildGroupCPrompt,
  buildGroupDPrompt,
  buildSummaryPromptV2,
} from "@/lib/deep-dive/prompts";

export {
  batchSearchAgentEcosystem,
  buildEcosystemContext,
  AGENT_FILE_PATTERNS,
  AGENT_FILE_TYPE_MAP,
  type AgentEcosystemRaw,
} from "@/lib/deep-dive/ecosystem";

// Import from sub-modules for internal use
import {
  safeParseJSON,
  parseStringArray,
  parseConfidence,
  parseSources,
  parseEnhancedSection,
  parseCodeQuality,
  parseCommunityHealth,
  parseDocumentationQuality,
  parseSecurityPosture,
  parseGettingStarted,
  parseAIPatternsV2,
  parseAgentEcosystem,
} from "@/lib/deep-dive/parsers";

import {
  buildGroupAPrompt,
  buildGroupBPrompt,
  buildGroupCPrompt,
  buildGroupDPrompt,
} from "@/lib/deep-dive/prompts";

import {
  batchSearchAgentEcosystem,
  buildEcosystemContext,
} from "@/lib/deep-dive/ecosystem";

// ── Fallback builder ─────────────────────────────────────────────

export function buildFallbackResultV2(repoUrl: string): DeepDiveResultV2 {
  const fallbackSection: EnhancedSection = { title: "Unknown", content: "Analysis failed for this repository.", confidence: "low", sources: [] };
  return {
    repo_url: repoUrl,
    repo_name: repoUrl.replace("https://github.com/", ""),
    stars: 0,
    contributors: null,
    license: "Unknown",
    primary_language: "Unknown",
    last_updated: new Date().toISOString().split("T")[0],
    overview: { ...fallbackSection, title: "Overview" },
    why_it_stands_out: { ...fallbackSection, title: "Why It Stands Out" },
    tech_stack: { languages: [], frameworks: [], infrastructure: [], key_dependencies: [], confidence: "low", sources: [] },
    architecture: { ...fallbackSection, title: "Architecture" },
    code_quality: { has_tests: false, test_framework: null, has_ci: false, ci_platform: null, ci_config_url: null, has_linting: false, linter: null, typescript_strict: null, code_coverage_mentioned: false, build_system: null, confidence: "low", sources: [] },
    community_health: { open_issues: null, closed_issues: null, contributors: null, last_commit_days_ago: null, has_contributing_guide: false, has_code_of_conduct: false, bus_factor_estimate: "low", confidence: "low", sources: [] },
    documentation_quality: { readme_sections: [], has_docs_directory: false, has_api_docs: false, api_docs_type: null, has_examples: false, has_changelog: false, has_tutorials: false, overall_grade: "missing", confidence: "low", sources: [] },
    security_posture: { has_security_policy: false, has_env_example: false, env_vars_documented: false, license_type: "Unknown", license_commercial_friendly: false, known_vulnerabilities_mentioned: false, auth_patterns: [], confidence: "low", sources: [] },
    ai_patterns: { has_ai_components: false, sdks_detected: [], agent_architecture: null, skill_files: [], mcp_usage: false, prompt_engineering: { has_system_prompts: false, has_few_shot: false, prompt_location: null }, confidence: "low", summary: "Could not determine AI patterns.", sources: [] },
    skills_required: { technical: [], design: [], domain: [] },
    agent_ecosystem: { discovered_files: [], ecosystem_mapping: { cursor: { has_config: false, rules_count: 0 }, claude: { has_skills: false, has_mcp: false }, other_agents: [] }, trending_tools: [], confidence: "low", sources: [] },
    getting_started: { prerequisites: [], install_commands: [], first_run_command: null, env_setup_steps: [], common_pitfalls: [], estimated_setup_time: null, confidence: "low", sources: [] },
    mode_specific: { ...fallbackSection, title: "Key Insights" },
  };
}

// ── Per-repo analysis helper (shared by single + batch paths) ────

async function analyzeRepoWithData(
  data: RawRepoData,
  repoUrl: string,
  ecosystemContext: string | undefined,
  searchId: string,
): Promise<DeepDiveResultV2> {
  // Fire 4 parallel LLM calls
  const promptA = buildGroupAPrompt(data);
  const promptB = buildGroupBPrompt(data);
  const promptC = buildGroupCPrompt(data, ecosystemContext);
  const promptD = buildGroupDPrompt(data);

  const [responseA, responseB, responseC, responseD] = await Promise.all([
    callLLMWithTools({ ...promptA, maxToolRounds: 0, searchId, operation: "deep_dive_v2" }),
    callLLMWithTools({ ...promptB, maxToolRounds: 0, searchId, operation: "deep_dive_v2" }),
    callLLMWithTools({ ...promptC, maxToolRounds: 0, searchId, operation: "deep_dive_v2" }),
    callLLMWithTools({ ...promptD, maxToolRounds: 0, searchId, operation: "deep_dive_v2" }),
  ]);

  // Parse and merge results
  const parsedA = safeParseJSON(responseA);
  const parsedB = safeParseJSON(responseB);
  const parsedC = safeParseJSON(responseC);
  const parsedD = safeParseJSON(responseD);

  const techStack = parsedA.tech_stack as Record<string, unknown> | undefined;
  const skillsReq = parsedC.skills_required as Record<string, unknown> | undefined;

  const result: DeepDiveResultV2 = {
    repo_url: repoUrl,
    repo_name: `${data.owner}/${data.repo}`,
    stars: typeof parsedA.stars === "number" ? parsedA.stars : 0,
    contributors: typeof parsedA.contributors === "number" ? parsedA.contributors : null,
    license: typeof parsedA.license === "string" ? parsedA.license : "Unknown",
    primary_language: typeof parsedA.primary_language === "string" ? parsedA.primary_language : "Unknown",
    last_updated: typeof parsedA.last_updated === "string" ? parsedA.last_updated : new Date().toISOString().split("T")[0],
    overview: parseEnhancedSection(parsedA.overview, "Overview"),
    why_it_stands_out: parseEnhancedSection(parsedA.why_it_stands_out, "Why It Stands Out"),
    tech_stack: {
      languages: techStack ? parseStringArray(techStack.languages) : [],
      frameworks: techStack && Array.isArray(techStack.frameworks) ? techStack.frameworks.map((f: unknown) => {
        if (typeof f === "string") return { name: f };
        if (f && typeof f === "object") {
          const o = f as Record<string, unknown>;
          return { name: String(o.name || ""), version: typeof o.version === "string" ? o.version : undefined, url: typeof o.url === "string" ? o.url : undefined };
        }
        return { name: "" };
      }).filter((f) => f.name) : [],
      infrastructure: techStack ? parseStringArray(techStack.infrastructure) : [],
      key_dependencies: techStack && Array.isArray(techStack.key_dependencies) ? techStack.key_dependencies.map((d: unknown) => {
        if (typeof d === "string") return { name: d };
        if (d && typeof d === "object") {
          const o = d as Record<string, unknown>;
          return { name: String(o.name || ""), version: typeof o.version === "string" ? o.version : undefined, url: typeof o.url === "string" ? o.url : undefined };
        }
        return { name: "" };
      }).filter((d) => d.name) : [],
      confidence: techStack ? parseConfidence(techStack.confidence) : "low",
      sources: techStack ? parseSources(techStack.sources) : [],
    },
    architecture: parseEnhancedSection(parsedA.architecture, "Architecture"),
    code_quality: parseCodeQuality(parsedB.code_quality),
    community_health: parseCommunityHealth(parsedB.community_health),
    documentation_quality: parseDocumentationQuality(parsedB.documentation_quality),
    security_posture: parseSecurityPosture(parsedB.security_posture),
    ai_patterns: parseAIPatternsV2(parsedC.ai_patterns),
    skills_required: {
      technical: skillsReq ? parseStringArray(skillsReq.technical) : [],
      design: skillsReq ? parseStringArray(skillsReq.design) : [],
      domain: skillsReq ? parseStringArray(skillsReq.domain) : [],
    },
    agent_ecosystem: parseAgentEcosystem(parsedC.agent_ecosystem),
    getting_started: parseGettingStarted(parsedD.getting_started),
    mode_specific: parseEnhancedSection(parsedC.mode_specific, "Key Insights"),
  };

  // Persist to Supabase
  await persistDeepDive(searchId, repoUrl, result);

  return result;
}

// ── Core analysis function (single repo) ─────────────────────────

export async function analyzeRepoV2(
  repoUrl: string,
  searchId: string,
): Promise<DeepDiveResultV2> {
  try {
    const data = await fetchRepoData(repoUrl);

    const repoInfo = { owner: data.owner, repo: data.repo, repoUrl };
    const ecosystemMap = await batchSearchAgentEcosystem([repoInfo], searchId);
    const ecosystemContext = buildEcosystemContext(ecosystemMap.get(repoUrl));

    return await analyzeRepoWithData(data, repoUrl, ecosystemContext, searchId);
  } catch (err) {
    console.error(`[deep-dive-analyzer-v2] Failed to analyze ${repoUrl}:`, err instanceof Error ? err.message : err);
    const fallback = buildFallbackResultV2(repoUrl);
    await persistDeepDive(searchId, repoUrl, fallback);
    return fallback;
  }
}

// ── Batch analysis function (shared ecosystem search) ────────────

export async function analyzeReposV2Batch(
  repoUrls: string[],
  searchId: string,
): Promise<DeepDiveResultV2[]> {
  if (repoUrls.length === 0) return [];

  try {
    // Fetch all repo data in parallel
    const allData = await fetchAllReposData(repoUrls);

    // Single batch ecosystem search for all repos
    const repoInfos = allData.map((d) => ({
      owner: d.owner,
      repo: d.repo,
      repoUrl: d.repoUrl,
    }));
    const ecosystemMap = await batchSearchAgentEcosystem(repoInfos, searchId);

    // Analyze each repo in parallel using shared ecosystem data
    const results = await Promise.allSettled(
      allData.map((data) => {
        const ecosystemContext = buildEcosystemContext(ecosystemMap.get(data.repoUrl));
        return analyzeRepoWithData(data, data.repoUrl, ecosystemContext, searchId);
      }),
    );

    return results.map((r, i) =>
      r.status === "fulfilled" ? r.value : buildFallbackResultV2(repoUrls[i]),
    );
  } catch (err) {
    console.error("[deep-dive-analyzer-v2] Batch analysis failed:", err instanceof Error ? err.message : err);
    return repoUrls.map((url) => buildFallbackResultV2(url));
  }
}
