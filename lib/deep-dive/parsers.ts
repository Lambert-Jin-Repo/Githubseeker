/**
 * Deep-dive parsers — shared defensive parsing for LLM JSON responses.
 * Used by both V1 and V2 analyzer orchestrators.
 */

import { extractJSON } from "@/lib/text-utils";
import type {
  EnhancedSection,
  CodeQuality,
  CommunityHealth,
  DocumentationQuality,
  SecurityPosture,
  GettingStarted,
  AIPatterns,
  SourceLink,
  ScoutSummaryV2,
  AgentEcosystemDiscovery,
} from "@/lib/types";

// ── Primitive helpers ────────────────────────────────────────────

export function parseStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === "string") : [];
}

export function parseSources(raw: unknown): SourceLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => s && typeof s === "object")
    .filter((s) => typeof s.label === "string" && typeof s.url === "string")
    .map((s) => ({ label: s.label as string, url: s.url as string }));
}

export function parseConfidence(raw: unknown): "high" | "medium" | "low" {
  return ["high", "medium", "low"].includes(raw as string)
    ? (raw as "high" | "medium" | "low")
    : "low";
}

export function safeParseJSON(text: string): Record<string, unknown> {
  try {
    const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, "");
    const cleaned = extractJSON(stripped);
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ── Section parsers ──────────────────────────────────────────────

export function parseEnhancedSection(raw: unknown, fallbackTitle: string): EnhancedSection {
  if (!raw || typeof raw !== "object") {
    return { title: fallbackTitle, content: "Analysis could not determine this section.", confidence: "low", sources: [] };
  }
  const obj = raw as Record<string, unknown>;
  return {
    title: typeof obj.title === "string" ? obj.title : fallbackTitle,
    content: typeof obj.content === "string" ? obj.content : "Analysis could not determine this section.",
    confidence: parseConfidence(obj.confidence),
    sources: parseSources(obj.sources),
  };
}

export function parseCodeQuality(raw: unknown): CodeQuality {
  if (!raw || typeof raw !== "object") {
    return { has_tests: false, test_framework: null, has_ci: false, ci_platform: null, ci_config_url: null, has_linting: false, linter: null, typescript_strict: null, code_coverage_mentioned: false, build_system: null, confidence: "low", sources: [] };
  }
  const obj = raw as Record<string, unknown>;
  return {
    has_tests: obj.has_tests === true,
    test_framework: typeof obj.test_framework === "string" ? obj.test_framework : null,
    has_ci: obj.has_ci === true,
    ci_platform: typeof obj.ci_platform === "string" ? obj.ci_platform : null,
    ci_config_url: typeof obj.ci_config_url === "string" ? obj.ci_config_url : null,
    has_linting: obj.has_linting === true,
    linter: typeof obj.linter === "string" ? obj.linter : null,
    typescript_strict: typeof obj.typescript_strict === "boolean" ? obj.typescript_strict : null,
    code_coverage_mentioned: obj.code_coverage_mentioned === true,
    build_system: typeof obj.build_system === "string" ? obj.build_system : null,
    confidence: parseConfidence(obj.confidence),
    sources: parseSources(obj.sources),
  };
}

export function parseCommunityHealth(raw: unknown): CommunityHealth {
  if (!raw || typeof raw !== "object") {
    return { open_issues: null, closed_issues: null, contributors: null, last_commit_days_ago: null, has_contributing_guide: false, has_code_of_conduct: false, bus_factor_estimate: "low", confidence: "low", sources: [] };
  }
  const obj = raw as Record<string, unknown>;
  return {
    open_issues: typeof obj.open_issues === "number" ? obj.open_issues : null,
    closed_issues: typeof obj.closed_issues === "number" ? obj.closed_issues : null,
    contributors: typeof obj.contributors === "number" ? obj.contributors : null,
    last_commit_days_ago: typeof obj.last_commit_days_ago === "number" ? obj.last_commit_days_ago : null,
    has_contributing_guide: obj.has_contributing_guide === true,
    has_code_of_conduct: obj.has_code_of_conduct === true,
    bus_factor_estimate: ["low", "medium", "high"].includes(obj.bus_factor_estimate as string) ? (obj.bus_factor_estimate as "low" | "medium" | "high") : "low",
    confidence: parseConfidence(obj.confidence),
    sources: parseSources(obj.sources),
  };
}

export function parseDocumentationQuality(raw: unknown): DocumentationQuality {
  if (!raw || typeof raw !== "object") {
    return { readme_sections: [], has_docs_directory: false, has_api_docs: false, api_docs_type: null, has_examples: false, has_changelog: false, has_tutorials: false, overall_grade: "missing", confidence: "low", sources: [] };
  }
  const obj = raw as Record<string, unknown>;
  return {
    readme_sections: Array.isArray(obj.readme_sections) ? obj.readme_sections.filter((s): s is string => typeof s === "string") : [],
    has_docs_directory: obj.has_docs_directory === true,
    has_api_docs: obj.has_api_docs === true,
    api_docs_type: typeof obj.api_docs_type === "string" ? obj.api_docs_type : null,
    has_examples: obj.has_examples === true,
    has_changelog: obj.has_changelog === true,
    has_tutorials: obj.has_tutorials === true,
    overall_grade: ["comprehensive", "adequate", "minimal", "missing"].includes(obj.overall_grade as string) ? (obj.overall_grade as "comprehensive" | "adequate" | "minimal" | "missing") : "missing",
    confidence: parseConfidence(obj.confidence),
    sources: parseSources(obj.sources),
  };
}

export function parseSecurityPosture(raw: unknown): SecurityPosture {
  if (!raw || typeof raw !== "object") {
    return { has_security_policy: false, has_env_example: false, env_vars_documented: false, license_type: "Unknown", license_commercial_friendly: false, known_vulnerabilities_mentioned: false, auth_patterns: [], confidence: "low", sources: [] };
  }
  const obj = raw as Record<string, unknown>;
  return {
    has_security_policy: obj.has_security_policy === true,
    has_env_example: obj.has_env_example === true,
    env_vars_documented: obj.env_vars_documented === true,
    license_type: typeof obj.license_type === "string" ? obj.license_type : "Unknown",
    license_commercial_friendly: obj.license_commercial_friendly === true,
    known_vulnerabilities_mentioned: obj.known_vulnerabilities_mentioned === true,
    auth_patterns: Array.isArray(obj.auth_patterns) ? obj.auth_patterns.filter((s): s is string => typeof s === "string") : [],
    confidence: parseConfidence(obj.confidence),
    sources: parseSources(obj.sources),
  };
}

export function parseGettingStarted(raw: unknown): GettingStarted {
  if (!raw || typeof raw !== "object") {
    return { prerequisites: [], install_commands: [], first_run_command: null, env_setup_steps: [], common_pitfalls: [], estimated_setup_time: null, confidence: "low", sources: [] };
  }
  const obj = raw as Record<string, unknown>;
  return {
    prerequisites: Array.isArray(obj.prerequisites) ? obj.prerequisites.filter((s): s is string => typeof s === "string") : [],
    install_commands: Array.isArray(obj.install_commands) ? obj.install_commands.filter((s): s is string => typeof s === "string") : [],
    first_run_command: typeof obj.first_run_command === "string" ? obj.first_run_command : null,
    env_setup_steps: Array.isArray(obj.env_setup_steps) ? obj.env_setup_steps.filter((s): s is string => typeof s === "string") : [],
    common_pitfalls: Array.isArray(obj.common_pitfalls) ? obj.common_pitfalls.filter((s): s is string => typeof s === "string") : [],
    estimated_setup_time: typeof obj.estimated_setup_time === "string" ? obj.estimated_setup_time : null,
    confidence: parseConfidence(obj.confidence),
    sources: parseSources(obj.sources),
  };
}

export function parseAIPatternsV2(raw: unknown): AIPatterns & { sources: SourceLink[] } {
  if (!raw || typeof raw !== "object") {
    return { has_ai_components: false, sdks_detected: [], agent_architecture: null, skill_files: [], mcp_usage: false, prompt_engineering: { has_system_prompts: false, has_few_shot: false, prompt_location: null }, confidence: "low", summary: "Could not determine AI patterns.", sources: [] };
  }
  const obj = raw as Record<string, unknown>;
  const pe = obj.prompt_engineering as Record<string, unknown> | undefined;
  return {
    has_ai_components: obj.has_ai_components === true,
    sdks_detected: Array.isArray(obj.sdks_detected) ? obj.sdks_detected.filter((s): s is string => typeof s === "string") : [],
    agent_architecture: typeof obj.agent_architecture === "string" ? obj.agent_architecture : null,
    skill_files: Array.isArray(obj.skill_files) ? obj.skill_files.filter((s): s is string => typeof s === "string") : [],
    mcp_usage: obj.mcp_usage === true,
    prompt_engineering: {
      has_system_prompts: pe?.has_system_prompts === true,
      has_few_shot: pe?.has_few_shot === true,
      prompt_location: pe && typeof pe.prompt_location === "string" ? pe.prompt_location : null,
    },
    confidence: parseConfidence(obj.confidence),
    summary: typeof obj.summary === "string" ? obj.summary : "Could not determine AI patterns.",
    sources: parseSources(obj.sources),
  };
}

export function parseAgentEcosystem(raw: unknown): AgentEcosystemDiscovery {
  const empty: AgentEcosystemDiscovery = {
    discovered_files: [],
    ecosystem_mapping: { cursor: { has_config: false, rules_count: 0 }, claude: { has_skills: false, has_mcp: false }, other_agents: [] },
    trending_tools: [],
    confidence: "low",
    sources: [],
  };
  if (!raw || typeof raw !== "object") return empty;
  const obj = raw as Record<string, unknown>;

  const eco = obj.ecosystem_mapping as Record<string, unknown> | undefined;
  const cursor = eco?.cursor as Record<string, unknown> | undefined;
  const claude = eco?.claude as Record<string, unknown> | undefined;

  return {
    discovered_files: Array.isArray(obj.discovered_files)
      ? obj.discovered_files
          .filter((f): f is Record<string, unknown> => f && typeof f === "object")
          .map((f) => ({
            type: (["cursorrules", "mcp_config", "claude_skills", "agents_config", "other"].includes(f.type as string)
              ? f.type : "other") as AgentEcosystemDiscovery["discovered_files"][number]["type"],
            path: typeof f.path === "string" ? f.path : "",
            url: typeof f.url === "string" ? f.url : "",
            summary: typeof f.summary === "string" ? f.summary : "",
          }))
      : [],
    ecosystem_mapping: {
      cursor: {
        has_config: cursor?.has_config === true,
        rules_count: typeof cursor?.rules_count === "number" ? cursor.rules_count : 0,
      },
      claude: {
        has_skills: claude?.has_skills === true,
        has_mcp: claude?.has_mcp === true,
      },
      other_agents: eco ? parseStringArray(eco.other_agents) : [],
    },
    trending_tools: Array.isArray(obj.trending_tools)
      ? obj.trending_tools
          .filter((t): t is Record<string, unknown> => t && typeof t === "object")
          .map((t) => ({
            name: typeof t.name === "string" ? t.name : "",
            relevance: typeof t.relevance === "string" ? t.relevance : "",
            url: typeof t.url === "string" ? t.url : undefined,
          }))
          .filter((t) => t.name)
      : [],
    confidence: parseConfidence(obj.confidence),
    sources: parseSources(obj.sources),
  };
}

// ── Summary parser ───────────────────────────────────────────────

export function parseSummaryV2(raw: Record<string, unknown>): ScoutSummaryV2 {
  const rec = raw.recommendation as Record<string, unknown> | undefined;
  const matrix = raw.comparative_matrix as Record<string, unknown> | undefined;

  return {
    takeaways: parseStringArray(raw.takeaways),
    recommendation: {
      repo: rec && typeof rec.repo === "string" ? rec.repo : "",
      repo_url: rec && typeof rec.repo_url === "string" ? rec.repo_url : "",
      reason: rec && typeof rec.reason === "string" ? rec.reason : "",
      mode: rec && ["learn", "build", "scout"].includes(rec.mode as string) ? (rec.mode as "learn" | "build" | "scout") : "scout",
    },
    comparative_matrix: {
      dimensions: matrix ? parseStringArray(matrix.dimensions) : [],
      repos: matrix && Array.isArray(matrix.repos) ? matrix.repos.map((r: unknown) => {
        if (!r || typeof r !== "object") return { repo_name: "", values: {} };
        const o = r as Record<string, unknown>;
        return {
          repo_name: typeof o.repo_name === "string" ? o.repo_name : "",
          values: o.values && typeof o.values === "object"
            ? Object.fromEntries(
                Object.entries(o.values as Record<string, unknown>)
                  .filter(([, v]) => typeof v === "string")
                  .map(([k, v]) => [k, v as string])
              )
            : {},
        };
      }) : [],
    },
    skills_roadmap: Array.isArray(raw.skills_roadmap) ? raw.skills_roadmap.map((r: unknown) => {
      if (!r || typeof r !== "object") return { step: 0, skill: "", description: "" };
      const o = r as Record<string, unknown>;
      return {
        step: typeof o.step === "number" ? o.step : 0,
        skill: typeof o.skill === "string" ? o.skill : "",
        description: typeof o.description === "string" ? o.description : "",
      };
    }) : [],
    ecosystem_gaps: Array.isArray(raw.ecosystem_gaps) ? raw.ecosystem_gaps.map((r: unknown) => {
      if (!r || typeof r !== "object") return { gap: "", opportunity: "" };
      const o = r as Record<string, unknown>;
      return {
        gap: typeof o.gap === "string" ? o.gap : "",
        opportunity: typeof o.opportunity === "string" ? o.opportunity : "",
      };
    }) : [],
    ai_ecosystem_notes: typeof raw.ai_ecosystem_notes === "string" ? raw.ai_ecosystem_notes : "",
  };
}
