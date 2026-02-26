import { describe, it, expect, beforeEach } from "vitest";
import { useScoutStore } from "../scout-store";
import type { DeepDiveResultV2, ScoutSummaryV2 } from "@/lib/types";

describe("ScoutStore", () => {
  beforeEach(() => {
    useScoutStore.getState().reset();
  });

  it("starts with empty state", () => {
    const state = useScoutStore.getState();
    expect(state.repos).toEqual([]);
    expect(state.mode).toBeNull();
    expect(state.isSearching).toBe(false);
    expect(state.phase1Complete).toBe(false);
    expect(state.phase2Complete).toBe(false);
  });

  it("sets mode", () => {
    useScoutStore.getState().setMode("LEARN");
    expect(useScoutStore.getState().mode).toBe("LEARN");
  });

  it("adds repos", () => {
    const repo = makeRepo("https://github.com/test/repo");
    useScoutStore.getState().addRepo(repo);
    expect(useScoutStore.getState().repos).toHaveLength(1);
    expect(useScoutStore.getState().repos[0].repo_name).toBe("test/repo");
  });

  it("updates repo verification in-place", () => {
    const repo = makeRepo("https://github.com/test/repo");
    useScoutStore.getState().addRepo(repo);
    useScoutStore.getState().updateRepoVerification("https://github.com/test/repo", {
      existence: { status: "live", checked_at: new Date().toISOString() },
    } as any);
    const updated = useScoutStore.getState().repos[0];
    expect(updated.verification.existence.status).toBe("live");
  });

  it("adds search progress", () => {
    useScoutStore.getState().addSearchProgress({ strategy: "high_star", status: "running", repos_found: 0 });
    expect(useScoutStore.getState().searchProgress).toHaveLength(1);

    // Update same strategy
    useScoutStore.getState().addSearchProgress({ strategy: "high_star", status: "complete", repos_found: 8 });
    expect(useScoutStore.getState().searchProgress).toHaveLength(1);
    expect(useScoutStore.getState().searchProgress[0].repos_found).toBe(8);
  });

  it("toggles repo selection with max 5 limit", () => {
    for (let i = 0; i < 7; i++) {
      useScoutStore.getState().addRepo(makeRepo(`https://github.com/test/repo${i}`));
    }

    const store = useScoutStore.getState();
    for (let i = 0; i < 5; i++) {
      store.toggleRepoSelection(`https://github.com/test/repo${i}`);
    }
    expect(useScoutStore.getState().selectedRepoUrls).toHaveLength(5);

    // 6th selection should not go through
    useScoutStore.getState().toggleRepoSelection("https://github.com/test/repo5");
    expect(useScoutStore.getState().selectedRepoUrls).toHaveLength(5);

    // Deselecting works
    useScoutStore.getState().toggleRepoSelection("https://github.com/test/repo0");
    expect(useScoutStore.getState().selectedRepoUrls).toHaveLength(4);
  });

  it("adds observations", () => {
    useScoutStore.getState().addObservation("Pattern found");
    expect(useScoutStore.getState().observations).toEqual(["Pattern found"]);
  });

  it("resets state", () => {
    useScoutStore.getState().setMode("LEARN");
    useScoutStore.getState().addObservation("test");
    useScoutStore.getState().reset();
    expect(useScoutStore.getState().mode).toBeNull();
    expect(useScoutStore.getState().observations).toEqual([]);
  });
});

describe("V2 deep dive state", () => {
  beforeEach(() => {
    useScoutStore.getState().reset();
  });

  it("stores deepDiveResultsV2 separately from V1", () => {
    const state = useScoutStore.getState();
    expect(state.deepDiveResultsV2).toEqual([]);
    expect(state.deepDiveResults).toEqual([]);
  });

  it("addDeepDiveResultV2 appends to V2 array", () => {
    const mockResult: DeepDiveResultV2 = {
      repo_url: "https://github.com/test/repo",
      repo_name: "test/repo",
      stars: 500,
      contributors: 12,
      license: "MIT",
      primary_language: "TypeScript",
      last_updated: "2026-02-01",
      overview: { title: "Overview", content: "A test repo", confidence: "high", sources: [] },
      why_it_stands_out: { title: "Standout", content: "Unique approach", confidence: "medium", sources: [] },
      tech_stack: {
        languages: ["TypeScript"],
        frameworks: [{ name: "Next.js" }],
        infrastructure: ["Vercel"],
        key_dependencies: [{ name: "React" }],
        confidence: "high",
        sources: [],
      },
      architecture: { title: "Architecture", content: "Modular", confidence: "high", sources: [] },
      code_quality: {
        has_tests: true,
        test_framework: "vitest",
        has_ci: true,
        ci_platform: "GitHub Actions",
        ci_config_url: null,
        has_linting: true,
        linter: "eslint",
        typescript_strict: true,
        code_coverage_mentioned: false,
        build_system: "turbo",
        confidence: "high",
        sources: [],
      },
      community_health: {
        open_issues: 10,
        closed_issues: 50,
        contributors: 12,
        last_commit_days_ago: 3,
        has_contributing_guide: true,
        has_code_of_conduct: true,
        bus_factor_estimate: "medium",
        confidence: "high",
        sources: [],
      },
      documentation_quality: {
        readme_sections: ["Installation", "Usage"],
        has_docs_directory: true,
        has_api_docs: true,
        api_docs_type: null,
        has_examples: true,
        has_changelog: true,
        has_tutorials: false,
        overall_grade: "comprehensive",
        confidence: "high",
        sources: [],
      },
      security_posture: {
        has_security_policy: true,
        has_env_example: false,
        env_vars_documented: false,
        license_type: "MIT",
        license_commercial_friendly: true,
        known_vulnerabilities_mentioned: false,
        auth_patterns: [],
        confidence: "medium",
        sources: [],
      },
      ai_patterns: {
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
        summary: "No AI components detected",
        sources: [],
      },
      skills_required: {
        technical: ["TypeScript"],
        design: [],
        domain: [],
      },
      getting_started: {
        prerequisites: ["Node.js"],
        install_commands: ["npm install"],
        first_run_command: "npm run dev",
        env_setup_steps: [],
        common_pitfalls: [],
        estimated_setup_time: "5 minutes",
        confidence: "high",
        sources: [],
      },
      mode_specific: { title: "Learn", content: "Good for learning", confidence: "high", sources: [] },
    };

    useScoutStore.getState().addDeepDiveResultV2(mockResult);
    expect(useScoutStore.getState().deepDiveResultsV2).toHaveLength(1);
    expect(useScoutStore.getState().deepDiveResultsV2[0].repo_name).toBe("test/repo");

    // V1 array should remain unaffected
    expect(useScoutStore.getState().deepDiveResults).toHaveLength(0);
  });

  it("setSummaryV2 stores V2 summary", () => {
    const mockSummary: ScoutSummaryV2 = {
      takeaways: ["Great TypeScript repo", "Active community"],
      recommendation: {
        repo: "test/repo",
        repo_url: "https://github.com/test/repo",
        reason: "Best for learning",
        mode: "learn",
      },
      comparative_matrix: {
        dimensions: ["stars", "activity"],
        repos: [{ repo_name: "test/repo", values: { stars: "500", activity: "high" } }],
      },
      skills_roadmap: [{ step: 1, skill: "TypeScript", description: "Learn basics" }],
      ecosystem_gaps: [{ gap: "Testing tools", opportunity: "Build a test helper" }],
      ai_ecosystem_notes: "No AI usage detected",
    };

    useScoutStore.getState().setSummaryV2(mockSummary);
    expect(useScoutStore.getState().summaryV2).not.toBeNull();
    expect(useScoutStore.getState().summaryV2!.takeaways).toHaveLength(2);
    expect(useScoutStore.getState().summaryV2!.recommendation.repo).toBe("test/repo");

    // V1 summary should remain unaffected
    expect(useScoutStore.getState().summary).toBeNull();
  });

  it("setDeepDivePageReady tracks navigation readiness", () => {
    expect(useScoutStore.getState().deepDivePageReady).toBe(false);
    useScoutStore.getState().setDeepDivePageReady(true);
    expect(useScoutStore.getState().deepDivePageReady).toBe(true);
  });

  it("reset clears V2 state", () => {
    useScoutStore.getState().setDeepDivePageReady(true);
    useScoutStore.getState().setSummaryV2({
      takeaways: ["test"],
      recommendation: { repo: "r", repo_url: "u", reason: "r", mode: "learn" },
      comparative_matrix: { dimensions: [], repos: [] },
      skills_roadmap: [],
      ecosystem_gaps: [],
      ai_ecosystem_notes: "",
    });

    useScoutStore.getState().reset();

    const state = useScoutStore.getState();
    expect(state.deepDiveResultsV2).toEqual([]);
    expect(state.summaryV2).toBeNull();
    expect(state.deepDivePageReady).toBe(false);
  });
});

function makeRepo(url: string) {
  return {
    repo_url: url,
    repo_name: url.replace("https://github.com/", ""),
    stars: 100,
    last_commit: "2026-01-01",
    primary_language: "TypeScript",
    license: "MIT",
    quality_tier: 1 as const,
    verification: {} as any,
    reddit_signal: "no_data" as const,
    summary: "Test",
    source_strategies: ["high_star"],
    is_selected: false,
  };
}
