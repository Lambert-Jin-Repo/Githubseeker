import { callLLMWithTools } from "@/lib/llm";
import { fetchRepoData, fetchAllReposData } from "@/lib/repo-data-fetcher";
import type { RawRepoData } from "@/lib/repo-data-fetcher";
import { persistDeepDive } from "@/lib/persistence";
import { extractJSON } from "@/lib/text-utils";
import { webSearch, fetchWebPage } from "@/lib/web-search";
import type {
  DeepDiveResultV2,
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

// ── Prompt builders ──────────────────────────────────────────────

function buildDataContext(data: RawRepoData): string {
  const sections: string[] = [];

  sections.push(`## Repository: ${data.owner}/${data.repo}`);
  sections.push(`URL: ${data.repoUrl}`);

  if (data.readmeContent) {
    sections.push(`\n## README Content (truncated to 8000 chars)\n${data.readmeContent.slice(0, 8000)}`);
  }

  if (data.depsContent) {
    sections.push(`\n## Dependency File Content (truncated to 4000 chars)\n${data.depsContent.slice(0, 4000)}`);
  }

  if (data.treeContent) {
    sections.push(`\n## Repository Tree HTML (truncated to 2000 chars)\n${data.treeContent.slice(0, 2000)}`);
  }

  if (data.ciConfigContent) {
    sections.push(`\n## CI Config Content (truncated to 4000 chars)\n${data.ciConfigContent.slice(0, 4000)}`);
  }

  if (data.communityResults.length > 0) {
    sections.push(`\n## Community Search Results\n${JSON.stringify(data.communityResults.slice(0, 5), null, 2)}`);
  }

  return sections.join("\n");
}

function buildGroupAPrompt(data: RawRepoData): { systemPrompt: string; userMessage: string } {
  const context = buildDataContext(data);
  return {
    systemPrompt: `You are GitHub Scout's Deep Dive analyzer (Group A). Analyze the provided repository data and output ONLY the sections assigned to you.

For every section, include a "sources" array with objects like {"label": "README.md", "url": "https://github.com/${data.owner}/${data.repo}/blob/main/README.md"} pointing to the actual files/URLs you extracted data from.

Mark confidence: "high" when data comes from fetched files, "medium" from search/inference, "low" when guessing.

Return a JSON object with EXACTLY these keys (no markdown fences, no extra text):
{
  "overview": { "title": "Overview", "content": "...", "confidence": "high"|"medium"|"low", "sources": [...] },
  "why_it_stands_out": { "title": "Why It Stands Out", "content": "...", "confidence": "...", "sources": [...] },
  "tech_stack": {
    "languages": ["..."],
    "frameworks": [{ "name": "...", "version": "...", "url": "..." }],
    "infrastructure": ["..."],
    "key_dependencies": [{ "name": "...", "version": "..." }],
    "confidence": "...",
    "sources": [...]
  },
  "architecture": { "title": "Architecture", "content": "...", "confidence": "...", "sources": [...] },
  "stars": 0,
  "contributors": null,
  "license": "MIT",
  "primary_language": "TypeScript",
  "last_updated": "2026-01-15"
}`,
    userMessage: `Analyze this repository data and extract: Overview, Why It Stands Out, Tech Stack, Architecture, and metadata (stars, contributors, license, language, last_updated).\n\n${context}`,
  };
}

function buildGroupBPrompt(data: RawRepoData): { systemPrompt: string; userMessage: string } {
  const context = buildDataContext(data);
  return {
    systemPrompt: `You are GitHub Scout's Deep Dive analyzer (Group B). Analyze the provided repository data and output ONLY the sections assigned to you.

For every section, include a "sources" array with objects like {"label": "...", "url": "https://github.com/${data.owner}/${data.repo}/blob/main/..."} pointing to the actual files/URLs you extracted data from.

Look for these indicators in the tree/page HTML:
- Tests: __tests__/, tests/, spec/, *.test.*, *.spec.*
- CI: .github/workflows/, .circleci/, .travis.yml, Jenkinsfile
- Linting: .eslintrc*, .prettierrc*, biome.json, ruff.toml
- Contributing: CONTRIBUTING.md, CODE_OF_CONDUCT.md
- Docs: docs/, documentation/, wiki
- Security: SECURITY.md, .env.example
- Changelog: CHANGELOG.md, CHANGES.md, HISTORY.md

Return a JSON object with EXACTLY these keys (no markdown fences, no extra text):
{
  "code_quality": {
    "has_tests": true|false, "test_framework": "vitest"|null, "has_ci": true|false, "ci_platform": "GitHub Actions"|null, "ci_config_url": "..."|null,
    "has_linting": true|false, "linter": "eslint"|null, "typescript_strict": true|false|null, "code_coverage_mentioned": true|false,
    "build_system": "next"|null, "confidence": "...", "sources": [...]
  },
  "community_health": {
    "open_issues": null, "closed_issues": null, "contributors": null, "last_commit_days_ago": null,
    "has_contributing_guide": true|false, "has_code_of_conduct": true|false,
    "bus_factor_estimate": "low"|"medium"|"high", "confidence": "...", "sources": [...]
  },
  "documentation_quality": {
    "readme_sections": ["..."], "has_docs_directory": true|false, "has_api_docs": true|false, "api_docs_type": "JSDoc"|null,
    "has_examples": true|false, "has_changelog": true|false, "has_tutorials": true|false,
    "overall_grade": "comprehensive"|"adequate"|"minimal"|"missing", "confidence": "...", "sources": [...]
  },
  "security_posture": {
    "has_security_policy": true|false, "has_env_example": true|false, "env_vars_documented": true|false,
    "license_type": "MIT", "license_commercial_friendly": true|false, "known_vulnerabilities_mentioned": true|false,
    "auth_patterns": ["..."], "confidence": "...", "sources": [...]
  }
}`,
    userMessage: `Analyze this repository data and extract: Code Quality, Community Health, Documentation Quality, and Security Posture.\n\n${context}`,
  };
}

function buildGroupCPrompt(data: RawRepoData, ecosystemContext?: string): { systemPrompt: string; userMessage: string } {
  const context = buildDataContext(data);
  return {
    systemPrompt: `You are GitHub Scout's Deep Dive analyzer (Group C). Analyze the provided repository data and output ONLY the sections assigned to you.

For every section, include a "sources" array with objects like {"label": "...", "url": "https://github.com/${data.owner}/${data.repo}/blob/main/..."}.

AI Pattern indicators to look for:
- Dependencies: openai, anthropic, langchain, llamaindex, crewai, autogen, google-generativeai
- Files: .cursorrules, .claude, mcp.json, skills.yaml
- Directories: .cursor/, .claude/, skills/, mcp/, agents/, prompts/
${ecosystemContext ? `
AGENT ECOSYSTEM DATA (from web search — these are REAL files found on GitHub for this repo):
${ecosystemContext}

Use this real data to populate the "agent_ecosystem" field. Report what was ACTUALLY FOUND, not guesses.
If no agent files were found, set discovered_files to empty array and has_config/has_skills to false.
` : ""}
Return a JSON object with EXACTLY these keys (no markdown fences, no extra text):
{
  "ai_patterns": {
    "has_ai_components": true|false, "sdks_detected": ["..."], "agent_architecture": "tool_calling"|null,
    "skill_files": ["..."], "mcp_usage": true|false,
    "prompt_engineering": { "has_system_prompts": true|false, "has_few_shot": true|false, "prompt_location": "..."|null },
    "confidence": "...", "summary": "...", "sources": [...]
  },
  "skills_required": {
    "technical": ["..."], "design": ["..."], "domain": ["..."]
  },
  "mode_specific": { "title": "Key Insights", "content": "...", "confidence": "...", "sources": [...] },
  "agent_ecosystem": {
    "discovered_files": [{"type": "cursorrules"|"mcp_config"|"claude_skills"|"agents_config"|"other", "path": "...", "url": "https://...", "summary": "..."}],
    "ecosystem_mapping": {
      "cursor": {"has_config": true|false, "rules_count": 0},
      "claude": {"has_skills": true|false, "has_mcp": true|false},
      "other_agents": ["..."]
    },
    "trending_tools": [{"name": "...", "relevance": "...", "url": "..."}],
    "confidence": "high"|"medium"|"low",
    "sources": [...]
  }
}`,
    userMessage: `Analyze this repository data and extract: AI Patterns, Skills Required, Mode-Specific Insights, and Agent Ecosystem.\n\n${context}`,
  };
}

function buildGroupDPrompt(data: RawRepoData): { systemPrompt: string; userMessage: string } {
  const context = buildDataContext(data);
  return {
    systemPrompt: `You are GitHub Scout's Deep Dive analyzer (Group D). Analyze the provided repository data and output ONLY the Getting Started section.

For every section, include a "sources" array with objects like {"label": "...", "url": "https://github.com/${data.owner}/${data.repo}/blob/main/..."}.

Look for: installation instructions in README, prerequisites mentioned, environment setup steps, common pitfalls or troubleshooting.

Return a JSON object with EXACTLY these keys (no markdown fences, no extra text):
{
  "getting_started": {
    "prerequisites": ["Node.js 20+", "..."],
    "install_commands": ["npm install", "..."],
    "first_run_command": "npm run dev"|null,
    "env_setup_steps": ["Copy .env.example to .env.local", "..."],
    "common_pitfalls": ["Must set API key first", "..."],
    "estimated_setup_time": "5 minutes"|null,
    "confidence": "...",
    "sources": [...]
  }
}`,
    userMessage: `Analyze this repository data and extract: Getting Started guide with prerequisites, install commands, env setup, and common pitfalls.\n\n${context}`,
  };
}

// ── Parsers ──────────────────────────────────────────────────────

function parseSources(raw: unknown): SourceLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => s && typeof s === "object")
    .filter((s) => typeof s.label === "string" && typeof s.url === "string")
    .map((s) => ({ label: s.label as string, url: s.url as string }));
}

function parseConfidence(raw: unknown): "high" | "medium" | "low" {
  return ["high", "medium", "low"].includes(raw as string)
    ? (raw as "high" | "medium" | "low")
    : "low";
}

function parseEnhancedSection(raw: unknown, fallbackTitle: string): EnhancedSection {
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

function parseCodeQuality(raw: unknown): CodeQuality {
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

function parseCommunityHealth(raw: unknown): CommunityHealth {
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

function parseDocumentationQuality(raw: unknown): DocumentationQuality {
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

function parseSecurityPosture(raw: unknown): SecurityPosture {
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

function parseGettingStarted(raw: unknown): GettingStarted {
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

function parseAIPatternsV2(raw: unknown): AIPatterns & { sources: SourceLink[] } {
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

function parseAgentEcosystem(raw: unknown): AgentEcosystemDiscovery {
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

function parseStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === "string") : [];
}

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

// ── Agent ecosystem batch search ─────────────────────────────────

interface AgentEcosystemRaw {
  fileUrls: Array<{ type: string; url: string; path: string }>;
  fileContents: Map<string, string>;
  // TODO: trending tools search deferred to next iteration
  trendingResults: Array<{ title: string; url: string; description: string }>;
}

const AGENT_FILE_PATTERNS = [".cursorrules", "mcp.json", "skills.yaml", ".claude"];
const AGENT_FILE_TYPE_MAP: Record<string, AgentEcosystemDiscovery["discovered_files"][number]["type"]> = {
  ".cursorrules": "cursorrules",
  "mcp.json": "mcp_config",
  "skills.yaml": "claude_skills",
  ".claude": "claude_skills",
  "agents.yaml": "agents_config",
  "agents.json": "agents_config",
};

async function batchSearchAgentEcosystem(
  repos: Array<{ owner: string; repo: string; repoUrl: string }>,
): Promise<Map<string, AgentEcosystemRaw>> {
  const result = new Map<string, AgentEcosystemRaw>();

  if (repos.length === 0) return result;

  // Initialize entries for all repos
  for (const r of repos) {
    result.set(r.repoUrl, { fileUrls: [], fileContents: new Map(), trendingResults: [] });
  }

  try {
    // Build a single Serper query for all repos
    const repoTerms = repos
      .slice(0, 6)
      .map((r) => `"${r.owner}/${r.repo}"`)
      .join(" OR ");
    const fileTerms = AGENT_FILE_PATTERNS.map((f) => `"${f}"`).join(" OR ");
    const query = `site:github.com (${fileTerms}) ${repoTerms}`;

    const searchResults = await webSearch(query, 20);

    for (const hit of searchResults) {
      const matchedRepo = repos.find(
        (r) => hit.url.includes(`${r.owner}/${r.repo}`)
      );
      if (!matchedRepo) continue;

      const matchedPattern = AGENT_FILE_PATTERNS.find((p) => hit.url.includes(p) || hit.title.includes(p));
      if (!matchedPattern) continue;

      const entry = result.get(matchedRepo.repoUrl)!;
      const pathFromUrl = hit.url.split("/blob/")[1]?.split("/").slice(1).join("/") || matchedPattern;
      entry.fileUrls.push({
        type: AGENT_FILE_TYPE_MAP[matchedPattern] || "other",
        url: hit.url,
        path: pathFromUrl,
      });
    }

    // Fetch discovered file contents in parallel (max 3 files per repo)
    const fetchPromises: Array<Promise<void>> = [];
    for (const [, data] of result) {
      for (const file of data.fileUrls.slice(0, 3)) {
        const rawUrl = file.url
          .replace("github.com", "raw.githubusercontent.com")
          .replace("/blob/", "/");
        fetchPromises.push(
          fetchWebPage(rawUrl)
            .then((content) => {
              data.fileContents.set(file.path, content.slice(0, 3000));
            })
            .catch(() => {
              // Silently skip failed fetches
            })
        );
      }
    }
    await Promise.allSettled(fetchPromises);

    return result;
  } catch (err) {
    console.error("[agent-ecosystem] Batch search failed:", err instanceof Error ? err.message : err);
    return result;
  }
}

// ── Per-repo analysis helper (shared by single + batch paths) ────

function buildEcosystemContext(
  ecosystemData: AgentEcosystemRaw | undefined,
): string | undefined {
  if (!ecosystemData || ecosystemData.fileUrls.length === 0) return undefined;
  const contextParts: string[] = [];
  for (const file of ecosystemData.fileUrls) {
    const content = ecosystemData.fileContents.get(file.path);
    contextParts.push(
      `File: ${file.path} (${file.type})\nURL: ${file.url}${content ? `\nContent:\n${content}` : ""}`,
    );
  }
  return contextParts.join("\n---\n");
}

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
    callLLMWithTools({ ...promptA, maxToolRounds: 0 }),
    callLLMWithTools({ ...promptB, maxToolRounds: 0 }),
    callLLMWithTools({ ...promptC, maxToolRounds: 0 }),
    callLLMWithTools({ ...promptD, maxToolRounds: 0 }),
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
    const ecosystemMap = await batchSearchAgentEcosystem([repoInfo]);
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
    const ecosystemMap = await batchSearchAgentEcosystem(repoInfos);

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

// ── Summary prompt builder ───────────────────────────────────────

export function buildSummaryPromptV2(results: DeepDiveResultV2[]): { systemPrompt: string; userMessage: string } {
  const repoSummaries = results.map((r) => ({
    name: r.repo_name,
    url: r.repo_url,
    stars: r.stars,
    overview: r.overview.content,
    tech_stack: r.tech_stack,
    ai: r.ai_patterns.summary,
    architecture: r.architecture.content,
    code_quality_confidence: r.code_quality.confidence,
    has_tests: r.code_quality.has_tests,
    doc_grade: r.documentation_quality.overall_grade,
  }));

  return {
    systemPrompt: `You are GitHub Scout's summary analyst. Generate a comprehensive cross-repo summary.

Return a JSON object with this EXACT structure (no markdown fences, no extra text):
{
  "takeaways": ["Key takeaway 1", "Key takeaway 2", "Key takeaway 3"],
  "recommendation": {
    "repo": "owner/repo",
    "repo_url": "https://github.com/owner/repo",
    "reason": "Why this is the best choice",
    "mode": "learn"|"build"|"scout"
  },
  "comparative_matrix": {
    "dimensions": ["Stars", "Language", "Tests", "Docs", "AI Usage"],
    "repos": [{ "repo_name": "owner/repo", "values": { "Stars": "1.2k", "Language": "TypeScript", "Tests": "Yes", "Docs": "Comprehensive", "AI Usage": "Tool calling" } }]
  },
  "skills_roadmap": [{ "step": 1, "skill": "TypeScript", "description": "Learn TypeScript basics" }],
  "ecosystem_gaps": [{ "gap": "No mobile SDK", "opportunity": "Build a React Native wrapper" }],
  "ai_ecosystem_notes": "Summary of AI patterns observed across all repos"
}`,
    userMessage: `Analyze these ${results.length} repositories and generate a comparative summary:\n\n${JSON.stringify(repoSummaries, null, 2)}`,
  };
}

// ── Helpers ──────────────────────────────────────────────────────

function safeParseJSON(text: string): Record<string, unknown> {
  try {
    const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, "");
    const cleaned = extractJSON(stripped);
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return {};
  }
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
