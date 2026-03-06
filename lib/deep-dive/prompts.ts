/**
 * Deep-dive prompt builders — construct LLM system prompts and user messages
 * for each analysis group (A through D) plus the cross-repo summary.
 */

import type { RawRepoData } from "@/lib/repo-data-fetcher";
import type { DeepDiveResultV2 } from "@/lib/types";

// ── Data context builder ─────────────────────────────────────────

export function buildDataContext(data: RawRepoData): string {
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

// ── Group prompts ────────────────────────────────────────────────

export function buildGroupAPrompt(data: RawRepoData): { systemPrompt: string; userMessage: string } {
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

export function buildGroupBPrompt(data: RawRepoData): { systemPrompt: string; userMessage: string } {
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

export function buildGroupCPrompt(data: RawRepoData, ecosystemContext?: string): { systemPrompt: string; userMessage: string } {
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

export function buildGroupDPrompt(data: RawRepoData): { systemPrompt: string; userMessage: string } {
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

// ── Summary prompt ───────────────────────────────────────────────

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
