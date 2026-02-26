import { describe, it, expect } from "vitest";
import type {
  ScoutMode,
  QualityTier,
  RepoResult,
  SourceLink,
  EnhancedSection,
  CodeQuality,
  CommunityHealth,
  DocumentationQuality,
  SecurityPosture,
  GettingStarted,
  DeepDiveResultV2,
  ScoutSummaryV2,
} from "../types";

describe("Type contracts", () => {
  it("ScoutMode values are valid", () => {
    const modes: ScoutMode[] = ["LEARN", "BUILD", "SCOUT"];
    expect(modes).toHaveLength(3);
  });

  it("QualityTier values are valid", () => {
    const tiers: QualityTier[] = [1, 2, 3];
    expect(tiers).toHaveLength(3);
  });

  it("RepoResult can be constructed", () => {
    const repo: RepoResult = {
      repo_url: "https://github.com/test/repo",
      repo_name: "test/repo",
      stars: 100,
      last_commit: "2026-01-01",
      primary_language: "TypeScript",
      license: "MIT",
      quality_tier: 1,
      verification: {
        existence: { status: "live", checked_at: new Date().toISOString() },
        stars: { value: 100, level: "verified", source: "github" },
        last_commit: { value: "2026-01-01", level: "verified" },
        language: { value: "TypeScript", level: "verified" },
        license: { value: "MIT", level: "verified" },
        freshness: { status: "active", level: "verified" },
        community: { signal: "no_data", level: "unverified" },
      },
      reddit_signal: "no_data",
      summary: "Test repo",
      source_strategies: ["high_star"],
      is_selected: false,
    };
    expect(repo.repo_name).toBe("test/repo");
  });
});

describe("V2 Deep Dive types", () => {
  it("SourceLink can be constructed", () => {
    const link: SourceLink = {
      label: "package.json",
      url: "https://github.com/owner/repo/blob/main/package.json",
    };
    expect(link.label).toBe("package.json");
  });

  it("EnhancedSection has sources array", () => {
    const section: EnhancedSection = {
      title: "Overview",
      content: "A test project",
      confidence: "high",
      sources: [{ label: "README", url: "https://github.com/owner/repo#readme" }],
    };
    expect(section.sources).toHaveLength(1);
  });

  it("DeepDiveResultV2 includes all 12 sections", () => {
    const result: DeepDiveResultV2 = {
      repo_url: "https://github.com/test/repo",
      repo_name: "test/repo",
      stars: 500,
      contributors: 10,
      license: "MIT",
      primary_language: "TypeScript",
      last_updated: "2026-02-20",
      overview: { title: "Overview", content: "Test", confidence: "high", sources: [] },
      why_it_stands_out: { title: "Why", content: "Test", confidence: "high", sources: [] },
      tech_stack: {
        languages: ["TypeScript"],
        frameworks: [{ name: "Next.js", version: "16.0.0", url: "https://github.com/vercel/next.js" }],
        infrastructure: ["Vercel"],
        key_dependencies: [{ name: "react", version: "19.0.0" }],
        confidence: "high",
        sources: [],
      },
      architecture: { title: "Architecture", content: "MVC", confidence: "medium", sources: [] },
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
        build_system: "next",
        confidence: "high",
        sources: [],
      },
      community_health: {
        open_issues: 15,
        closed_issues: 200,
        contributors: 10,
        last_commit_days_ago: 2,
        has_contributing_guide: true,
        has_code_of_conduct: false,
        bus_factor_estimate: "medium",
        confidence: "high",
        sources: [],
      },
      documentation_quality: {
        readme_sections: ["Installation", "Usage", "API"],
        has_docs_directory: true,
        has_api_docs: true,
        api_docs_type: "JSDoc",
        has_examples: true,
        has_changelog: true,
        has_tutorials: false,
        overall_grade: "comprehensive",
        confidence: "high",
        sources: [],
      },
      security_posture: {
        has_security_policy: true,
        has_env_example: true,
        env_vars_documented: true,
        license_type: "MIT",
        license_commercial_friendly: true,
        known_vulnerabilities_mentioned: false,
        auth_patterns: ["JWT"],
        confidence: "medium",
        sources: [],
      },
      ai_patterns: {
        has_ai_components: true,
        sdks_detected: ["openai"],
        agent_architecture: "tool_calling",
        skill_files: [],
        mcp_usage: false,
        prompt_engineering: {
          has_system_prompts: true,
          has_few_shot: false,
          prompt_location: "src/prompts/",
        },
        confidence: "high",
        summary: "Uses OpenAI tool calling",
        sources: [],
      },
      skills_required: {
        technical: ["TypeScript", "React"],
        design: ["API Design"],
        domain: ["ML"],
      },
      getting_started: {
        prerequisites: ["Node.js 20+"],
        install_commands: ["npm install"],
        first_run_command: "npm run dev",
        env_setup_steps: ["Copy .env.example to .env.local"],
        common_pitfalls: ["Must set API key first"],
        estimated_setup_time: "5 minutes",
        confidence: "high",
        sources: [],
      },
      mode_specific: { title: "Insights", content: "Good for learning", confidence: "medium", sources: [] },
    };
    expect(result.repo_name).toBe("test/repo");
    expect(result.code_quality.has_tests).toBe(true);
    expect(result.community_health.contributors).toBe(10);
    expect(result.documentation_quality.overall_grade).toBe("comprehensive");
    expect(result.security_posture.has_security_policy).toBe(true);
    expect(result.getting_started.install_commands).toEqual(["npm install"]);
  });

  it("ScoutSummaryV2 includes comparative matrix", () => {
    const summary: ScoutSummaryV2 = {
      takeaways: ["Key insight"],
      recommendation: {
        repo: "test/repo",
        repo_url: "https://github.com/test/repo",
        reason: "Best for learning",
        mode: "learn",
      },
      comparative_matrix: {
        dimensions: ["Stars", "Language"],
        repos: [{
          repo_name: "test/repo",
          values: { Stars: "500", Language: "TypeScript" },
        }],
      },
      skills_roadmap: [{ step: 1, skill: "TypeScript", description: "Learn TS basics" }],
      ecosystem_gaps: [{ gap: "No mobile SDK", opportunity: "Build one" }],
      ai_ecosystem_notes: "Most repos use tool calling pattern",
    };
    expect(summary.comparative_matrix.repos).toHaveLength(1);
    expect(summary.skills_roadmap[0].step).toBe(1);
  });
});
