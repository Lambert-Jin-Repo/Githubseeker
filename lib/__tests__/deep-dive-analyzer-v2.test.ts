import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../llm", () => ({
  callLLMWithTools: vi.fn(),
}));
vi.mock("../repo-data-fetcher", () => ({
  fetchRepoData: vi.fn(),
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

import { analyzeRepoV2 } from "../deep-dive-analyzer-v2";
import { callLLMWithTools } from "../llm";
import { fetchRepoData } from "../repo-data-fetcher";
import { webSearch, fetchWebPage } from "../web-search";

const mockedLLM = vi.mocked(callLLMWithTools);
const mockedFetchRepo = vi.mocked(fetchRepoData);
const mockedWebSearch = vi.mocked(webSearch);
const mockedFetchWebPage = vi.mocked(fetchWebPage);

describe("analyzeRepoV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedWebSearch.mockResolvedValue([]);
    mockedFetchWebPage.mockResolvedValue("");

    mockedFetchRepo.mockResolvedValue({
      repoUrl: "https://github.com/test/repo",
      owner: "test",
      repo: "repo",
      repoPageHtml: "<html>stars: 500</html>",
      readmeContent: "# Test Repo\nA test project",
      treeContent: "<html>file tree</html>",
      depsContent: '{"name": "test", "dependencies": {"react": "^19.0.0"}}',
      ciConfigContent: null,
      communityResults: [],
    });

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
});
