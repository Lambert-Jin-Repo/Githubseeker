import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../llm", () => ({
  callLLMWithTools: vi.fn(),
}));
vi.mock("../repo-data-fetcher", () => ({
  fetchRepoData: vi.fn(),
  fetchAllReposData: vi.fn(),
}));
vi.mock("../supabase", () => ({
  createServerClient: () => ({
    from: () => ({
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: () => Promise.resolve({ data: [{ id: "1" }], error: null }),
          }),
        }),
      }),
    }),
  }),
}));
vi.mock("../web-search", () => ({
  webSearch: vi.fn(),
  fetchWebPage: vi.fn(),
}));

import { analyzeRepoV2, analyzeReposV2Batch } from "../deep-dive-analyzer-v2";
import { callLLMWithTools } from "../llm";
import { fetchRepoData, fetchAllReposData } from "../repo-data-fetcher";
import { webSearch, fetchWebPage } from "../web-search";

const mockedLLM = vi.mocked(callLLMWithTools);
const mockedFetchRepo = vi.mocked(fetchRepoData);
const mockedFetchAllRepos = vi.mocked(fetchAllReposData);
const mockedWebSearch = vi.mocked(webSearch);
const mockedFetchWebPage = vi.mocked(fetchWebPage);

describe("analyzeRepoV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedWebSearch.mockResolvedValue([]);
    mockedFetchWebPage.mockResolvedValue("");

    const mockRepoData = {
      repoUrl: "https://github.com/test/repo",
      owner: "test",
      repo: "repo",
      repoPageHtml: "<html>stars: 500</html>",
      readmeContent: "# Test Repo\nA test project",
      treeContent: "<html>file tree</html>",
      depsContent: '{"name": "test", "dependencies": {"react": "^19.0.0"}}',
      ciConfigContent: null,
      communityResults: [],
    };

    mockedFetchRepo.mockResolvedValue(mockRepoData);
    mockedFetchAllRepos.mockResolvedValue([mockRepoData]);

    // Mock all 4 parallel LLM calls to return valid JSON
    mockedLLM.mockResolvedValue(JSON.stringify({
      overview: { title: "Overview", content: "Test project", confidence: "high", sources: [] },
      why_it_stands_out: { title: "Why", content: "Unique", confidence: "high", sources: [] },
      tech_stack: { languages: ["TypeScript"], frameworks: [], infrastructure: [], key_dependencies: [], confidence: "high", sources: [] },
      architecture: { title: "Arch", content: "MVC", confidence: "medium", sources: [] },
      code_quality: { has_tests: false, test_framework: null, has_ci: false, ci_platform: null, ci_config_url: null, has_linting: false, linter: null, typescript_strict: null, code_coverage_mentioned: false, build_system: null, confidence: "low", sources: [] },
      community_health: { open_issues: null, closed_issues: null, contributors: null, last_commit_days_ago: null, has_contributing_guide: false, has_code_of_conduct: false, bus_factor_estimate: "low", confidence: "low", sources: [] },
      documentation_quality: { readme_sections: [], has_docs_directory: false, has_api_docs: false, api_docs_type: null, has_examples: false, has_changelog: false, has_tutorials: false, overall_grade: "minimal", confidence: "low", sources: [] },
      security_posture: { has_security_policy: false, has_env_example: false, env_vars_documented: false, license_type: "Unknown", license_commercial_friendly: false, known_vulnerabilities_mentioned: false, auth_patterns: [], confidence: "low", sources: [] },
      ai_patterns: { has_ai_components: false, sdks_detected: [], agent_architecture: null, skill_files: [], mcp_usage: false, prompt_engineering: { has_system_prompts: false, has_few_shot: false, prompt_location: null }, confidence: "low", summary: "No AI", sources: [] },
      skills_required: { technical: [], design: [], domain: [] },
      agent_ecosystem: { discovered_files: [], ecosystem_mapping: { cursor: { has_config: false, rules_count: 0 }, claude: { has_skills: false, has_mcp: false }, other_agents: [] }, trending_tools: [], confidence: "low", sources: [] },
      getting_started: { prerequisites: [], install_commands: [], first_run_command: null, env_setup_steps: [], common_pitfalls: [], estimated_setup_time: null, confidence: "low", sources: [] },
      mode_specific: { title: "Insights", content: "N/A", confidence: "low", sources: [] },
      stars: 500,
      contributors: null,
      license: "MIT",
      primary_language: "TypeScript",
      last_updated: "2026-02-20",
    }));
  });

  it("calls fetchRepoData then fires parallel LLM calls", async () => {
    const result = await analyzeRepoV2("https://github.com/test/repo", "search-123");

    expect(mockedFetchRepo).toHaveBeenCalledWith("https://github.com/test/repo");
    // Should make 4 parallel LLM calls
    expect(mockedLLM).toHaveBeenCalledTimes(4);
    expect(result.repo_url).toBe("https://github.com/test/repo");
    expect(result.overview).toBeDefined();
    expect(result.code_quality).toBeDefined();
  });

  it("returns fallback on total failure", async () => {
    mockedFetchRepo.mockRejectedValue(new Error("Network error"));

    const result = await analyzeRepoV2("https://github.com/test/repo", "search-123");

    expect(result.repo_url).toBe("https://github.com/test/repo");
    expect(result.overview.confidence).toBe("low");
  });

  it("includes agent_ecosystem data when batch search finds files", async () => {
    mockedWebSearch.mockResolvedValue([
      {
        title: ".cursorrules - test/repo",
        url: "https://github.com/test/repo/blob/main/.cursorrules",
        description: "Cursor rules for this project",
      },
    ]);
    mockedFetchWebPage.mockResolvedValue("Use TypeScript strict mode\nPrefer functional patterns");

    // Group C mock should return agent_ecosystem with discovered data
    mockedLLM.mockResolvedValue(JSON.stringify({
      overview: { title: "Overview", content: "Test", confidence: "high", sources: [] },
      why_it_stands_out: { title: "Why", content: "Unique", confidence: "high", sources: [] },
      tech_stack: { languages: ["TS"], frameworks: [], infrastructure: [], key_dependencies: [], confidence: "high", sources: [] },
      architecture: { title: "Arch", content: "MVC", confidence: "medium", sources: [] },
      code_quality: { has_tests: false, test_framework: null, has_ci: false, ci_platform: null, ci_config_url: null, has_linting: false, linter: null, typescript_strict: null, code_coverage_mentioned: false, build_system: null, confidence: "low", sources: [] },
      community_health: { open_issues: null, closed_issues: null, contributors: null, last_commit_days_ago: null, has_contributing_guide: false, has_code_of_conduct: false, bus_factor_estimate: "low", confidence: "low", sources: [] },
      documentation_quality: { readme_sections: [], has_docs_directory: false, has_api_docs: false, api_docs_type: null, has_examples: false, has_changelog: false, has_tutorials: false, overall_grade: "minimal", confidence: "low", sources: [] },
      security_posture: { has_security_policy: false, has_env_example: false, env_vars_documented: false, license_type: "Unknown", license_commercial_friendly: false, known_vulnerabilities_mentioned: false, auth_patterns: [], confidence: "low", sources: [] },
      ai_patterns: { has_ai_components: true, sdks_detected: [], agent_architecture: null, skill_files: [".cursorrules"], mcp_usage: false, prompt_engineering: { has_system_prompts: false, has_few_shot: false, prompt_location: null }, confidence: "high", summary: "Has cursor rules", sources: [] },
      skills_required: { technical: ["TypeScript"], design: [], domain: [] },
      agent_ecosystem: {
        discovered_files: [{ type: "cursorrules", path: ".cursorrules", url: "https://github.com/test/repo/blob/main/.cursorrules", summary: "TypeScript strict mode and functional patterns" }],
        ecosystem_mapping: { cursor: { has_config: true, rules_count: 2 }, claude: { has_skills: false, has_mcp: false }, other_agents: [] },
        trending_tools: [],
        confidence: "high",
        sources: [],
      },
      getting_started: { prerequisites: [], install_commands: [], first_run_command: null, env_setup_steps: [], common_pitfalls: [], estimated_setup_time: null, confidence: "low", sources: [] },
      mode_specific: { title: "Insights", content: "N/A", confidence: "low", sources: [] },
      stars: 500, contributors: null, license: "MIT", primary_language: "TypeScript", last_updated: "2026-02-20",
    }));

    const result = await analyzeRepoV2("https://github.com/test/repo", "search-123");

    expect(result.agent_ecosystem.discovered_files).toHaveLength(1);
    expect(result.agent_ecosystem.discovered_files[0].type).toBe("cursorrules");
    expect(result.agent_ecosystem.ecosystem_mapping.cursor.has_config).toBe(true);
    expect(mockedWebSearch).toHaveBeenCalled();
  });

  it("handles batch search failure gracefully", async () => {
    mockedWebSearch.mockRejectedValue(new Error("Serper rate limit"));

    const result = await analyzeRepoV2("https://github.com/test/repo", "search-123");

    expect(result.agent_ecosystem).toBeDefined();
    expect(result.agent_ecosystem.discovered_files).toEqual([]);
    expect(result.repo_url).toBe("https://github.com/test/repo");
  });
});

describe("analyzeReposV2Batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedWebSearch.mockResolvedValue([]);
    mockedFetchWebPage.mockResolvedValue("");

    const mockRepoData = {
      repoUrl: "https://github.com/test/repo",
      owner: "test",
      repo: "repo",
      repoPageHtml: "<html>stars: 500</html>",
      readmeContent: "# Test Repo\nA test project",
      treeContent: "<html>file tree</html>",
      depsContent: '{"name": "test", "dependencies": {"react": "^19.0.0"}}',
      ciConfigContent: null,
      communityResults: [],
    };
    const mockRepoData2 = {
      ...mockRepoData,
      repoUrl: "https://github.com/test/repo2",
      owner: "test",
      repo: "repo2",
    };

    mockedFetchAllRepos.mockResolvedValue([mockRepoData, mockRepoData2]);

    mockedLLM.mockResolvedValue(JSON.stringify({
      overview: { title: "Overview", content: "Test", confidence: "high", sources: [] },
      why_it_stands_out: { title: "Why", content: "Unique", confidence: "high", sources: [] },
      tech_stack: { languages: ["TS"], frameworks: [], infrastructure: [], key_dependencies: [], confidence: "high", sources: [] },
      architecture: { title: "Arch", content: "MVC", confidence: "medium", sources: [] },
      code_quality: { has_tests: false, test_framework: null, has_ci: false, ci_platform: null, ci_config_url: null, has_linting: false, linter: null, typescript_strict: null, code_coverage_mentioned: false, build_system: null, confidence: "low", sources: [] },
      community_health: { open_issues: null, closed_issues: null, contributors: null, last_commit_days_ago: null, has_contributing_guide: false, has_code_of_conduct: false, bus_factor_estimate: "low", confidence: "low", sources: [] },
      documentation_quality: { readme_sections: [], has_docs_directory: false, has_api_docs: false, api_docs_type: null, has_examples: false, has_changelog: false, has_tutorials: false, overall_grade: "minimal", confidence: "low", sources: [] },
      security_posture: { has_security_policy: false, has_env_example: false, env_vars_documented: false, license_type: "Unknown", license_commercial_friendly: false, known_vulnerabilities_mentioned: false, auth_patterns: [], confidence: "low", sources: [] },
      ai_patterns: { has_ai_components: false, sdks_detected: [], agent_architecture: null, skill_files: [], mcp_usage: false, prompt_engineering: { has_system_prompts: false, has_few_shot: false, prompt_location: null }, confidence: "low", summary: "No AI", sources: [] },
      skills_required: { technical: [], design: [], domain: [] },
      agent_ecosystem: { discovered_files: [], ecosystem_mapping: { cursor: { has_config: false, rules_count: 0 }, claude: { has_skills: false, has_mcp: false }, other_agents: [] }, trending_tools: [], confidence: "low", sources: [] },
      getting_started: { prerequisites: [], install_commands: [], first_run_command: null, env_setup_steps: [], common_pitfalls: [], estimated_setup_time: null, confidence: "low", sources: [] },
      mode_specific: { title: "Insights", content: "N/A", confidence: "low", sources: [] },
      stars: 500, contributors: null, license: "MIT", primary_language: "TypeScript", last_updated: "2026-02-20",
    }));
  });

  it("uses fetchAllReposData and single batchSearchAgentEcosystem call", async () => {
    const results = await analyzeReposV2Batch(
      ["https://github.com/test/repo", "https://github.com/test/repo2"],
      "search-456",
    );

    expect(results).toHaveLength(2);
    expect(results[0].repo_url).toBe("https://github.com/test/repo");
    expect(results[1].repo_url).toBe("https://github.com/test/repo2");

    // fetchAllReposData called once (not fetchRepoData per repo)
    expect(mockedFetchAllRepos).toHaveBeenCalledTimes(1);
    expect(mockedFetchRepo).not.toHaveBeenCalled();

    // batchSearchAgentEcosystem does 1 webSearch call for all repos
    expect(mockedWebSearch).toHaveBeenCalledTimes(1);

    // 4 LLM calls per repo × 2 repos = 8
    expect(mockedLLM).toHaveBeenCalledTimes(8);
  });

  it("returns empty array for empty input", async () => {
    const results = await analyzeReposV2Batch([], "search-456");
    expect(results).toEqual([]);
  });

  it("returns fallbacks when fetchAllReposData fails", async () => {
    mockedFetchAllRepos.mockRejectedValue(new Error("Network error"));

    const results = await analyzeReposV2Batch(
      ["https://github.com/test/repo"],
      "search-456",
    );

    expect(results).toHaveLength(1);
    expect(results[0].overview.confidence).toBe("low");
  });
});

describe("V2 parser malformed input", () => {
  const mockRepoData = {
    repoUrl: "https://github.com/test/repo",
    owner: "test",
    repo: "repo",
    repoPageHtml: "<html>stars: 100</html>",
    readmeContent: "# Malformed Test",
    treeContent: "<html>tree</html>",
    depsContent: '{"name": "test"}',
    ciConfigContent: null,
    communityResults: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchRepo.mockResolvedValue(mockRepoData);
    mockedWebSearch.mockResolvedValue([]);
    mockedFetchWebPage.mockResolvedValue("");
  });

  it("(a) empty string — produces fallback result with default values", async () => {
    mockedLLM.mockResolvedValue("");

    const result = await analyzeRepoV2("https://github.com/test/repo", "search-789");

    expect(result.repo_url).toBe("https://github.com/test/repo");
    expect(result.repo_name).toBe("test/repo");

    // Group A fields: metadata falls back to defaults
    expect(result.stars).toBe(0);
    expect(result.contributors).toBeNull();
    expect(result.license).toBe("Unknown");
    expect(result.primary_language).toBe("Unknown");

    // EnhancedSection fields fall back to "low" confidence with default content
    expect(result.overview.confidence).toBe("low");
    expect(result.overview.content).toBe("Analysis could not determine this section.");
    expect(result.why_it_stands_out.confidence).toBe("low");
    expect(result.architecture.confidence).toBe("low");

    // Group B: structured fields get fallback defaults
    expect(result.code_quality.has_tests).toBe(false);
    expect(result.code_quality.confidence).toBe("low");
    expect(result.community_health.bus_factor_estimate).toBe("low");
    expect(result.documentation_quality.overall_grade).toBe("missing");
    expect(result.security_posture.license_type).toBe("Unknown");

    // Group C: AI patterns and agent ecosystem
    expect(result.ai_patterns.has_ai_components).toBe(false);
    expect(result.ai_patterns.summary).toBe("Could not determine AI patterns.");
    expect(result.agent_ecosystem.discovered_files).toEqual([]);
    expect(result.skills_required.technical).toEqual([]);

    // Group D: Getting started
    expect(result.getting_started.prerequisites).toEqual([]);
    expect(result.getting_started.install_commands).toEqual([]);
    expect(result.getting_started.first_run_command).toBeNull();

    // Mode specific
    expect(result.mode_specific.confidence).toBe("low");
  });

  it("(b) partial JSON with missing fields — defaults for missing fields", async () => {
    // Group A returns only overview, missing tech_stack/architecture/metadata
    // Group B returns only code_quality, missing community/docs/security
    // Group C returns only ai_patterns, missing skills/mode_specific/agent_ecosystem
    // Group D returns getting_started with only prerequisites
    mockedLLM
      .mockResolvedValueOnce(JSON.stringify({
        overview: { title: "Partial Overview", content: "Some content", confidence: "high", sources: [{ label: "README", url: "https://github.com/test/repo/blob/main/README.md" }] },
        // tech_stack, why_it_stands_out, architecture, stars, license, etc. are MISSING
      }))
      .mockResolvedValueOnce(JSON.stringify({
        code_quality: { has_tests: true, test_framework: "vitest", has_ci: true, ci_platform: "GitHub Actions", ci_config_url: null, has_linting: true, linter: "eslint", typescript_strict: true, code_coverage_mentioned: false, build_system: "vite", confidence: "high", sources: [] },
        // community_health, documentation_quality, security_posture are MISSING
      }))
      .mockResolvedValueOnce(JSON.stringify({
        ai_patterns: { has_ai_components: true, sdks_detected: ["openai"], agent_architecture: "tool_calling", skill_files: [], mcp_usage: false, prompt_engineering: { has_system_prompts: true, has_few_shot: false, prompt_location: "lib/prompts" }, confidence: "high", summary: "Uses OpenAI SDK", sources: [] },
        // skills_required, mode_specific, agent_ecosystem are MISSING
      }))
      .mockResolvedValueOnce(JSON.stringify({
        getting_started: { prerequisites: ["Node.js 20+"], install_commands: [], first_run_command: null, env_setup_steps: [], common_pitfalls: [], estimated_setup_time: null, confidence: "medium", sources: [] },
      }));

    const result = await analyzeRepoV2("https://github.com/test/repo", "search-789");

    // Present fields parsed correctly
    expect(result.overview.title).toBe("Partial Overview");
    expect(result.overview.content).toBe("Some content");
    expect(result.overview.confidence).toBe("high");
    expect(result.overview.sources).toHaveLength(1);

    expect(result.code_quality.has_tests).toBe(true);
    expect(result.code_quality.test_framework).toBe("vitest");
    expect(result.code_quality.has_ci).toBe(true);
    expect(result.code_quality.linter).toBe("eslint");

    expect(result.ai_patterns.has_ai_components).toBe(true);
    expect(result.ai_patterns.sdks_detected).toEqual(["openai"]);
    expect(result.ai_patterns.prompt_engineering.has_system_prompts).toBe(true);

    expect(result.getting_started.prerequisites).toEqual(["Node.js 20+"]);
    expect(result.getting_started.confidence).toBe("medium");

    // Missing fields fall back to defaults
    expect(result.stars).toBe(0);
    expect(result.license).toBe("Unknown");
    expect(result.primary_language).toBe("Unknown");
    expect(result.tech_stack.languages).toEqual([]);
    expect(result.tech_stack.frameworks).toEqual([]);
    expect(result.why_it_stands_out.confidence).toBe("low");
    expect(result.architecture.confidence).toBe("low");

    expect(result.community_health.confidence).toBe("low");
    expect(result.community_health.has_contributing_guide).toBe(false);
    expect(result.documentation_quality.overall_grade).toBe("missing");
    expect(result.security_posture.license_type).toBe("Unknown");

    expect(result.skills_required.technical).toEqual([]);
    expect(result.skills_required.design).toEqual([]);
    expect(result.agent_ecosystem.discovered_files).toEqual([]);
    expect(result.mode_specific.confidence).toBe("low");
  });

  it("(c) wrong types for fields — handles gracefully with defaults", async () => {
    // All groups return JSON with wrong types for fields
    mockedLLM
      .mockResolvedValueOnce(JSON.stringify({
        overview: { title: 42, content: true, confidence: 999, sources: "not-array" },
        why_it_stands_out: "should be object",
        tech_stack: { languages: "not-array", frameworks: 123, infrastructure: null, key_dependencies: false, confidence: [], sources: 42 },
        architecture: null,
        stars: "not-a-number",
        contributors: "fifty",
        license: 42,
        primary_language: false,
        last_updated: 20260220,
      }))
      .mockResolvedValueOnce(JSON.stringify({
        code_quality: { has_tests: "yes", test_framework: 42, has_ci: 1, ci_platform: true, ci_config_url: [], has_linting: "true", linter: false, typescript_strict: "yes", code_coverage_mentioned: "no", build_system: 123, confidence: 42, sources: "none" },
        community_health: { open_issues: "many", closed_issues: true, contributors: "50+", last_commit_days_ago: "yesterday", has_contributing_guide: "yes", has_code_of_conduct: 1, bus_factor_estimate: 3, confidence: true, sources: null },
        documentation_quality: { readme_sections: "intro, setup", has_docs_directory: "yes", has_api_docs: 1, api_docs_type: 42, has_examples: "true", has_changelog: 1, has_tutorials: 0, overall_grade: 5, confidence: false, sources: {} },
        security_posture: { has_security_policy: 1, has_env_example: "yes", env_vars_documented: "true", license_type: 42, license_commercial_friendly: "yes", known_vulnerabilities_mentioned: 0, auth_patterns: "jwt, oauth", confidence: 99, sources: false },
      }))
      .mockResolvedValueOnce(JSON.stringify({
        ai_patterns: { has_ai_components: "yes", sdks_detected: "openai", agent_architecture: 42, skill_files: true, mcp_usage: "yes", prompt_engineering: "none", confidence: [], summary: 42, sources: "no" },
        skills_required: { technical: "TypeScript", design: 42, domain: true },
        mode_specific: 42,
        agent_ecosystem: { discovered_files: "none", ecosystem_mapping: "not-object", trending_tools: "none", confidence: true, sources: 42 },
      }))
      .mockResolvedValueOnce(JSON.stringify({
        getting_started: { prerequisites: "Node.js", install_commands: 42, first_run_command: true, env_setup_steps: 123, common_pitfalls: false, estimated_setup_time: 5, confidence: null, sources: "no" },
      }));

    const result = await analyzeRepoV2("https://github.com/test/repo", "search-789");

    expect(result.repo_url).toBe("https://github.com/test/repo");
    expect(result.repo_name).toBe("test/repo");

    // Group A: wrong typed metadata defaults
    expect(result.stars).toBe(0); // "not-a-number" -> 0
    expect(result.contributors).toBeNull(); // "fifty" -> null
    expect(result.license).toBe("Unknown"); // 42 -> "Unknown"
    expect(result.primary_language).toBe("Unknown"); // false -> "Unknown"
    expect(typeof result.last_updated).toBe("string"); // 20260220 (number) -> today's date

    // EnhancedSection with wrong types falls back
    expect(result.overview.title).toBe("Overview"); // 42 -> fallback title
    expect(result.overview.content).toBe("Analysis could not determine this section."); // true -> fallback
    expect(result.overview.confidence).toBe("low"); // 999 -> "low"
    expect(result.overview.sources).toEqual([]); // "not-array" -> []

    expect(result.why_it_stands_out.confidence).toBe("low"); // "should be object" -> fallback section
    expect(result.architecture.confidence).toBe("low"); // null -> fallback section

    // Tech stack with wrong types
    expect(result.tech_stack.languages).toEqual([]); // "not-array" -> []
    expect(result.tech_stack.frameworks).toEqual([]); // 123 -> []
    expect(result.tech_stack.confidence).toBe("low"); // [] -> "low"

    // Group B: code_quality with wrong types
    expect(result.code_quality.has_tests).toBe(false); // "yes" !== true -> false
    expect(result.code_quality.test_framework).toBeNull(); // 42 -> null
    expect(result.code_quality.has_ci).toBe(false); // 1 !== true -> false
    expect(result.code_quality.ci_platform).toBeNull(); // true -> null (not string)
    expect(result.code_quality.has_linting).toBe(false); // "true" !== true -> false
    expect(result.code_quality.linter).toBeNull(); // false -> null
    expect(result.code_quality.typescript_strict).toBeNull(); // "yes" not boolean -> null
    expect(result.code_quality.build_system).toBeNull(); // 123 -> null

    // community_health with wrong types
    expect(result.community_health.open_issues).toBeNull(); // "many" -> null
    expect(result.community_health.contributors).toBeNull(); // "50+" -> null
    expect(result.community_health.has_contributing_guide).toBe(false); // "yes" !== true -> false
    expect(result.community_health.bus_factor_estimate).toBe("low"); // 3 -> "low"

    // documentation_quality with wrong types
    expect(result.documentation_quality.readme_sections).toEqual([]); // "intro, setup" is a string in array -> filtered out
    expect(result.documentation_quality.has_docs_directory).toBe(false); // "yes" !== true -> false
    expect(result.documentation_quality.overall_grade).toBe("missing"); // 5 -> "missing"

    // security_posture with wrong types
    expect(result.security_posture.has_security_policy).toBe(false); // 1 !== true -> false
    expect(result.security_posture.license_type).toBe("Unknown"); // 42 -> "Unknown"
    expect(result.security_posture.auth_patterns).toEqual([]); // "jwt, oauth" -> []

    // Group C: ai_patterns with wrong types
    expect(result.ai_patterns.has_ai_components).toBe(false); // "yes" !== true -> false
    expect(result.ai_patterns.sdks_detected).toEqual([]); // "openai" not array -> []
    expect(result.ai_patterns.agent_architecture).toBeNull(); // 42 -> null
    expect(result.ai_patterns.mcp_usage).toBe(false); // "yes" !== true -> false
    // prompt_engineering is "none" (string), so pe?.has_system_prompts => undefined
    expect(result.ai_patterns.prompt_engineering.has_system_prompts).toBe(false);
    expect(result.ai_patterns.summary).toBe("Could not determine AI patterns."); // 42 -> fallback

    // skills_required with wrong types
    expect(result.skills_required.technical).toEqual([]); // "TypeScript" not array -> []
    expect(result.skills_required.design).toEqual([]); // 42 -> []
    expect(result.skills_required.domain).toEqual([]); // true -> []

    // agent_ecosystem with wrong types
    expect(result.agent_ecosystem.discovered_files).toEqual([]); // "none" -> []
    expect(result.agent_ecosystem.trending_tools).toEqual([]); // "none" -> []
    expect(result.agent_ecosystem.confidence).toBe("low"); // true -> "low"

    // mode_specific: 42 is not object -> fallback
    expect(result.mode_specific.confidence).toBe("low");

    // Group D: getting_started with wrong types
    expect(result.getting_started.prerequisites).toEqual([]); // "Node.js" not array -> []
    expect(result.getting_started.install_commands).toEqual([]); // 42 -> []
    expect(result.getting_started.first_run_command).toBeNull(); // true -> null
    expect(result.getting_started.estimated_setup_time).toBeNull(); // 5 (number) -> null
    expect(result.getting_started.confidence).toBe("low"); // null -> "low"
  });

  it("(d) <think> tags wrapping JSON — strips tags and parses correctly", async () => {
    const validGroupA = JSON.stringify({
      overview: { title: "Think-Wrapped Overview", content: "This was wrapped in think tags", confidence: "high", sources: [{ label: "README", url: "https://github.com/test/repo/blob/main/README.md" }] },
      why_it_stands_out: { title: "Why It Stands Out", content: "Innovative approach", confidence: "medium", sources: [] },
      tech_stack: { languages: ["TypeScript", "Python"], frameworks: [{ name: "Next.js", version: "14.0.0" }], infrastructure: ["Vercel"], key_dependencies: [{ name: "react", version: "19.0.0" }], confidence: "high", sources: [] },
      architecture: { title: "Architecture", content: "Monorepo with turborepo", confidence: "high", sources: [] },
      stars: 1500,
      contributors: 42,
      license: "Apache-2.0",
      primary_language: "TypeScript",
      last_updated: "2026-03-01",
    });

    const validGroupB = JSON.stringify({
      code_quality: { has_tests: true, test_framework: "jest", has_ci: true, ci_platform: "GitHub Actions", ci_config_url: "https://github.com/test/repo/blob/main/.github/workflows/ci.yml", has_linting: true, linter: "biome", typescript_strict: true, code_coverage_mentioned: true, build_system: "turbo", confidence: "high", sources: [] },
      community_health: { open_issues: 23, closed_issues: 156, contributors: 42, last_commit_days_ago: 2, has_contributing_guide: true, has_code_of_conduct: true, bus_factor_estimate: "high", confidence: "high", sources: [] },
      documentation_quality: { readme_sections: ["Install", "Usage", "API"], has_docs_directory: true, has_api_docs: true, api_docs_type: "TypeDoc", has_examples: true, has_changelog: true, has_tutorials: true, overall_grade: "comprehensive", confidence: "high", sources: [] },
      security_posture: { has_security_policy: true, has_env_example: true, env_vars_documented: true, license_type: "Apache-2.0", license_commercial_friendly: true, known_vulnerabilities_mentioned: false, auth_patterns: ["JWT", "OAuth2"], confidence: "high", sources: [] },
    });

    const validGroupC = JSON.stringify({
      ai_patterns: { has_ai_components: true, sdks_detected: ["openai", "langchain"], agent_architecture: "tool_calling", skill_files: [".cursorrules"], mcp_usage: true, prompt_engineering: { has_system_prompts: true, has_few_shot: true, prompt_location: "src/prompts/" }, confidence: "high", summary: "Full AI agent with MCP support", sources: [] },
      skills_required: { technical: ["TypeScript", "Python"], design: ["System Design"], domain: ["AI/ML"] },
      mode_specific: { title: "Key Insights", content: "Strong AI foundation", confidence: "high", sources: [] },
      agent_ecosystem: { discovered_files: [{ type: "cursorrules", path: ".cursorrules", url: "https://github.com/test/repo/blob/main/.cursorrules", summary: "Coding standards" }], ecosystem_mapping: { cursor: { has_config: true, rules_count: 5 }, claude: { has_skills: true, has_mcp: true }, other_agents: ["copilot"] }, trending_tools: [{ name: "cursor", relevance: "high", url: "https://cursor.com" }], confidence: "high", sources: [] },
    });

    const validGroupD = JSON.stringify({
      getting_started: { prerequisites: ["Node.js 20+", "Python 3.11+"], install_commands: ["npm install", "pip install -r requirements.txt"], first_run_command: "npm run dev", env_setup_steps: ["Copy .env.example to .env"], common_pitfalls: ["Must set OPENAI_API_KEY"], estimated_setup_time: "10 minutes", confidence: "high", sources: [{ label: "README", url: "https://github.com/test/repo/blob/main/README.md" }] },
    });

    // Wrap each in <think> tags with reasoning content
    mockedLLM
      .mockResolvedValueOnce(`<think>The user wants me to analyze the overview and tech stack. Let me look at the README...</think>${validGroupA}`)
      .mockResolvedValueOnce(`<think>Analyzing code quality indicators. I see test files and CI config...</think>\n${validGroupB}`)
      .mockResolvedValueOnce(`<think>Looking for AI patterns in the codebase...\nFound openai SDK and .cursorrules file.</think>\n\n${validGroupC}`)
      .mockResolvedValueOnce(`<think>Extracting getting started info from README.\nPrerequisites: Node.js and Python.\nInstall: npm and pip.\n</think>${validGroupD}`);

    const result = await analyzeRepoV2("https://github.com/test/repo", "search-789");

    // Group A: all values should be parsed correctly despite <think> wrapping
    expect(result.overview.title).toBe("Think-Wrapped Overview");
    expect(result.overview.content).toBe("This was wrapped in think tags");
    expect(result.overview.confidence).toBe("high");
    expect(result.overview.sources).toHaveLength(1);
    expect(result.overview.sources[0].label).toBe("README");

    expect(result.why_it_stands_out.content).toBe("Innovative approach");
    expect(result.tech_stack.languages).toEqual(["TypeScript", "Python"]);
    expect(result.tech_stack.frameworks).toHaveLength(1);
    expect(result.tech_stack.frameworks[0].name).toBe("Next.js");
    expect(result.architecture.content).toBe("Monorepo with turborepo");

    expect(result.stars).toBe(1500);
    expect(result.contributors).toBe(42);
    expect(result.license).toBe("Apache-2.0");
    expect(result.primary_language).toBe("TypeScript");
    expect(result.last_updated).toBe("2026-03-01");

    // Group B: code quality parsed correctly
    expect(result.code_quality.has_tests).toBe(true);
    expect(result.code_quality.test_framework).toBe("jest");
    expect(result.code_quality.has_ci).toBe(true);
    expect(result.code_quality.ci_platform).toBe("GitHub Actions");
    expect(result.code_quality.typescript_strict).toBe(true);

    expect(result.community_health.open_issues).toBe(23);
    expect(result.community_health.closed_issues).toBe(156);
    expect(result.community_health.contributors).toBe(42);
    expect(result.community_health.bus_factor_estimate).toBe("high");

    expect(result.documentation_quality.readme_sections).toEqual(["Install", "Usage", "API"]);
    expect(result.documentation_quality.overall_grade).toBe("comprehensive");
    expect(result.documentation_quality.has_tutorials).toBe(true);

    expect(result.security_posture.has_security_policy).toBe(true);
    expect(result.security_posture.license_type).toBe("Apache-2.0");
    expect(result.security_posture.auth_patterns).toEqual(["JWT", "OAuth2"]);

    // Group C: AI patterns parsed correctly
    expect(result.ai_patterns.has_ai_components).toBe(true);
    expect(result.ai_patterns.sdks_detected).toEqual(["openai", "langchain"]);
    expect(result.ai_patterns.agent_architecture).toBe("tool_calling");
    expect(result.ai_patterns.mcp_usage).toBe(true);
    expect(result.ai_patterns.prompt_engineering.has_system_prompts).toBe(true);
    expect(result.ai_patterns.prompt_engineering.has_few_shot).toBe(true);
    expect(result.ai_patterns.summary).toBe("Full AI agent with MCP support");

    expect(result.skills_required.technical).toEqual(["TypeScript", "Python"]);
    expect(result.skills_required.design).toEqual(["System Design"]);
    expect(result.skills_required.domain).toEqual(["AI/ML"]);

    expect(result.agent_ecosystem.discovered_files).toHaveLength(1);
    expect(result.agent_ecosystem.discovered_files[0].type).toBe("cursorrules");
    expect(result.agent_ecosystem.ecosystem_mapping.cursor.has_config).toBe(true);
    expect(result.agent_ecosystem.ecosystem_mapping.cursor.rules_count).toBe(5);
    expect(result.agent_ecosystem.ecosystem_mapping.claude.has_skills).toBe(true);
    expect(result.agent_ecosystem.ecosystem_mapping.claude.has_mcp).toBe(true);
    expect(result.agent_ecosystem.trending_tools).toHaveLength(1);

    expect(result.mode_specific.content).toBe("Strong AI foundation");
    expect(result.mode_specific.confidence).toBe("high");

    // Group D: Getting started parsed correctly
    expect(result.getting_started.prerequisites).toEqual(["Node.js 20+", "Python 3.11+"]);
    expect(result.getting_started.install_commands).toEqual(["npm install", "pip install -r requirements.txt"]);
    expect(result.getting_started.first_run_command).toBe("npm run dev");
    expect(result.getting_started.common_pitfalls).toEqual(["Must set OPENAI_API_KEY"]);
    expect(result.getting_started.estimated_setup_time).toBe("10 minutes");
    expect(result.getting_started.confidence).toBe("high");
    expect(result.getting_started.sources).toHaveLength(1);
  });
});
