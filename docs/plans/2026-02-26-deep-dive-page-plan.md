# Deep Dive Analysis Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the inline deep dive section with a dedicated `/scout/[id]/deep-dive` page featuring 12 analysis sections per repo, parallel data fetching + parallel LLM analysis, inline source links, sticky sidebar navigation, and progressive reveal loading.

**Architecture:** New Next.js route page at `app/scout/[id]/deep-dive/`. Data gathering decoupled from LLM analysis — Node.js fetches raw data in parallel, then fires 4 specialized LLM calls per repo simultaneously. Results persist to Supabase JSONB column. V2 types coexist with V1 for backward compatibility.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, MiniMax M2.5 via OpenAI SDK, Supabase JSONB, SSE streaming.

**Design Doc:** `docs/plans/2026-02-26-deep-dive-page-design.md`

---

## Task 1: Add V2 Types to `lib/types.ts`

**Files:**
- Modify: `lib/types.ts:61-121`
- Test: `lib/__tests__/types.test.ts`

**Step 1: Write the failing test**

Add to `lib/__tests__/types.test.ts`:

```typescript
import type {
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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/types.test.ts`
Expected: FAIL — types not exported

**Step 3: Write the V2 types**

Add to `lib/types.ts` after the existing `ScoutSummary` interface (after line 121):

```typescript
// ===== Deep Dive V2 =====
export interface SourceLink {
  label: string;
  url: string;
}

export interface EnhancedSection {
  title: string;
  content: string;
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

export interface CodeQuality {
  has_tests: boolean;
  test_framework: string | null;
  has_ci: boolean;
  ci_platform: string | null;
  ci_config_url: string | null;
  has_linting: boolean;
  linter: string | null;
  typescript_strict: boolean | null;
  code_coverage_mentioned: boolean;
  build_system: string | null;
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

export interface CommunityHealth {
  open_issues: number | null;
  closed_issues: number | null;
  contributors: number | null;
  last_commit_days_ago: number | null;
  has_contributing_guide: boolean;
  has_code_of_conduct: boolean;
  bus_factor_estimate: "low" | "medium" | "high";
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

export interface DocumentationQuality {
  readme_sections: string[];
  has_docs_directory: boolean;
  has_api_docs: boolean;
  api_docs_type: string | null;
  has_examples: boolean;
  has_changelog: boolean;
  has_tutorials: boolean;
  overall_grade: "comprehensive" | "adequate" | "minimal" | "missing";
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

export interface SecurityPosture {
  has_security_policy: boolean;
  has_env_example: boolean;
  env_vars_documented: boolean;
  license_type: string;
  license_commercial_friendly: boolean;
  known_vulnerabilities_mentioned: boolean;
  auth_patterns: string[];
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

export interface GettingStarted {
  prerequisites: string[];
  install_commands: string[];
  first_run_command: string | null;
  env_setup_steps: string[];
  common_pitfalls: string[];
  estimated_setup_time: string | null;
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

export interface DeepDiveResultV2 {
  repo_url: string;
  repo_name: string;
  stars: number;
  contributors: number | null;
  license: string;
  primary_language: string;
  last_updated: string;
  overview: EnhancedSection;
  why_it_stands_out: EnhancedSection;
  tech_stack: {
    languages: string[];
    frameworks: Array<{ name: string; version?: string; url?: string }>;
    infrastructure: string[];
    key_dependencies: Array<{ name: string; version?: string; url?: string }>;
    confidence: "high" | "medium" | "low";
    sources: SourceLink[];
  };
  architecture: EnhancedSection;
  code_quality: CodeQuality;
  community_health: CommunityHealth;
  documentation_quality: DocumentationQuality;
  security_posture: SecurityPosture;
  ai_patterns: AIPatterns & { sources: SourceLink[] };
  skills_required: {
    technical: string[];
    design: string[];
    domain: string[];
  };
  getting_started: GettingStarted;
  mode_specific: EnhancedSection;
}

export interface ScoutSummaryV2 {
  takeaways: string[];
  recommendation: {
    repo: string;
    repo_url: string;
    reason: string;
    mode: "learn" | "build" | "scout";
  };
  comparative_matrix: {
    dimensions: string[];
    repos: Array<{
      repo_name: string;
      values: Record<string, string>;
    }>;
  };
  skills_roadmap: Array<{
    step: number;
    skill: string;
    description: string;
  }>;
  ecosystem_gaps: Array<{
    gap: string;
    opportunity: string;
  }>;
  ai_ecosystem_notes: string;
}
```

Also update the `SSEEvent` union (around line 135) to add V2 event types:

```typescript
  | { type: "deep_dive_complete_v2"; data: DeepDiveResultV2 }
  | { type: "summary_v2"; data: ScoutSummaryV2 }
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/types.ts lib/__tests__/types.test.ts
git commit -m "feat: add V2 deep dive types with enhanced sections and source links"
```

---

## Task 2: Build `lib/repo-data-fetcher.ts` — Parallel Data Gathering

**Files:**
- Create: `lib/repo-data-fetcher.ts`
- Test: `lib/__tests__/repo-data-fetcher.test.ts`

**Step 1: Write the failing test**

Create `lib/__tests__/repo-data-fetcher.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock web-search module
vi.mock("../web-search", () => ({
  fetchWebPage: vi.fn(),
  webSearch: vi.fn(),
}));

import { fetchRepoData, type RawRepoData } from "../repo-data-fetcher";
import { fetchWebPage, webSearch } from "../web-search";

const mockedFetch = vi.mocked(fetchWebPage);
const mockedSearch = vi.mocked(webSearch);

describe("fetchRepoData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetch.mockResolvedValue("<html>mock page</html>");
    mockedSearch.mockResolvedValue([]);
  });

  it("fetches all data sources in parallel and returns RawRepoData", async () => {
    const result = await fetchRepoData("https://github.com/vercel/next.js");

    expect(result.repoUrl).toBe("https://github.com/vercel/next.js");
    expect(result.repoPageHtml).toBe("<html>mock page</html>");
    // Should have called fetchWebPage for repo page, README, tree, and dep file
    expect(mockedFetch).toHaveBeenCalledTimes(4);
    // Should have called webSearch for community context
    expect(mockedSearch).toHaveBeenCalledTimes(1);
  });

  it("handles fetch failures gracefully with null", async () => {
    mockedFetch.mockRejectedValue(new Error("Network error"));
    mockedSearch.mockRejectedValue(new Error("Search failed"));

    const result = await fetchRepoData("https://github.com/test/repo");

    expect(result.repoUrl).toBe("https://github.com/test/repo");
    expect(result.repoPageHtml).toBeNull();
    expect(result.readmeContent).toBeNull();
    expect(result.treeContent).toBeNull();
    expect(result.depsContent).toBeNull();
    expect(result.communityResults).toEqual([]);
  });

  it("extracts owner/repo from URL correctly", async () => {
    await fetchRepoData("https://github.com/facebook/react");

    // Should fetch README at correct URL
    expect(mockedFetch).toHaveBeenCalledWith(
      expect.stringContaining("facebook/react")
    );
  });
});

describe("fetchAllReposData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetch.mockResolvedValue("<html>mock</html>");
    mockedSearch.mockResolvedValue([]);
  });

  it("fetches data for multiple repos in parallel", async () => {
    const { fetchAllReposData } = await import("../repo-data-fetcher");
    const urls = [
      "https://github.com/vercel/next.js",
      "https://github.com/facebook/react",
    ];

    const results = await fetchAllReposData(urls);

    expect(results).toHaveLength(2);
    expect(results[0].repoUrl).toBe("https://github.com/vercel/next.js");
    expect(results[1].repoUrl).toBe("https://github.com/facebook/react");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/repo-data-fetcher.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the data fetcher**

Create `lib/repo-data-fetcher.ts`:

```typescript
import { fetchWebPage, webSearch } from "@/lib/web-search";
import type { WebSearchResult } from "@/lib/web-search";

export interface RawRepoData {
  repoUrl: string;
  owner: string;
  repo: string;
  repoPageHtml: string | null;
  readmeContent: string | null;
  treeContent: string | null;
  depsContent: string | null;
  communityResults: WebSearchResult[];
}

function extractOwnerRepo(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  return match ? { owner: match[1], repo: match[2] } : { owner: "", repo: "" };
}

async function safeFetch(url: string): Promise<string | null> {
  try {
    return await fetchWebPage(url);
  } catch {
    return null;
  }
}

async function safeSearch(query: string): Promise<WebSearchResult[]> {
  try {
    return await webSearch(query, 5);
  } catch {
    return [];
  }
}

export async function fetchRepoData(repoUrl: string): Promise<RawRepoData> {
  const { owner, repo } = extractOwnerRepo(repoUrl);

  const [repoPageHtml, readmeContent, treeContent, depsContent, communityResults] =
    await Promise.all([
      safeFetch(repoUrl),
      safeFetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`),
      safeFetch(`${repoUrl}/tree/main`),
      safeFetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/package.json`)
        .then(async (r) => {
          if (r) return r;
          // Try requirements.txt, go.mod, Cargo.toml
          return (
            (await safeFetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/requirements.txt`)) ||
            (await safeFetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/go.mod`)) ||
            (await safeFetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/Cargo.toml`))
          );
        }),
      safeSearch(`${owner}/${repo} github review OR comparison OR alternatives`),
    ]);

  return {
    repoUrl,
    owner,
    repo,
    repoPageHtml,
    readmeContent,
    treeContent,
    depsContent,
    communityResults,
  };
}

export async function fetchAllReposData(repoUrls: string[]): Promise<RawRepoData[]> {
  const results = await Promise.allSettled(
    repoUrls.map((url) => fetchRepoData(url))
  );
  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          repoUrl: repoUrls[i],
          owner: "",
          repo: "",
          repoPageHtml: null,
          readmeContent: null,
          treeContent: null,
          depsContent: null,
          communityResults: [],
        }
  );
}
```

**Note:** You may need to check `lib/web-search.ts` for the `WebSearchResult` export. If it's not exported, export the type:
```typescript
export interface WebSearchResult { title: string; url: string; description: string; }
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/repo-data-fetcher.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/repo-data-fetcher.ts lib/__tests__/repo-data-fetcher.test.ts
git commit -m "feat: add parallel repo data fetcher for V2 deep dive"
```

---

## Task 3: Build `lib/deep-dive-analyzer-v2.ts` — Parallel LLM Analysis

**Files:**
- Create: `lib/deep-dive-analyzer-v2.ts`
- Depends on: `lib/repo-data-fetcher.ts`, `lib/llm.ts`, `lib/types.ts`

**Step 1: Write the failing test**

Create `lib/__tests__/deep-dive-analyzer-v2.test.ts`:

```typescript
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

import { analyzeRepoV2 } from "../deep-dive-analyzer-v2";
import { callLLMWithTools } from "../llm";
import { fetchRepoData } from "../repo-data-fetcher";

const mockedLLM = vi.mocked(callLLMWithTools);
const mockedFetchRepo = vi.mocked(fetchRepoData);

describe("analyzeRepoV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedFetchRepo.mockResolvedValue({
      repoUrl: "https://github.com/test/repo",
      owner: "test",
      repo: "repo",
      repoPageHtml: "<html>stars: 500</html>",
      readmeContent: "# Test Repo\nA test project",
      treeContent: "<html>file tree</html>",
      depsContent: '{"name": "test", "dependencies": {"react": "^19.0.0"}}',
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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/deep-dive-analyzer-v2.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the V2 analyzer**

Create `lib/deep-dive-analyzer-v2.ts`. This is the largest new file. Key structure:

1. `buildGroupAPrompt(data)` — Overview, Why It Stands Out, Tech Stack, Architecture
2. `buildGroupBPrompt(data)` — Code Quality, Community Health, Docs Quality, Security
3. `buildGroupCPrompt(data)` — AI Patterns, Skills Required, Mode-Specific
4. `buildGroupDPrompt(data)` — Getting Started, cross-check verification
5. `analyzeRepoV2(repoUrl, searchId)` — orchestrates fetch + 4 parallel LLM calls + merge + persist
6. `buildSummaryPromptV2(results)` — cross-repo summary with comparative matrix
7. `buildFallbackResultV2(repoUrl)` — empty/default V2 result
8. Parsers for each new section type

Each LLM call receives ALL raw data (README, package.json, tree, repo page, community search results) but is instructed to only output its assigned sections. Each prompt instructs the LLM to include `sources` arrays with GitHub URLs pointing to the actual files the data came from (e.g., `https://github.com/{owner}/{repo}/blob/main/package.json`).

**The prompts should instruct MiniMax to:**
- Use the raw README content to extract project purpose, installation steps, architecture docs
- Use the raw package.json / deps file to extract exact version numbers and build links
- Use the tree listing HTML to detect presence of .github/workflows/, docs/, SECURITY.md, CONTRIBUTING.md, examples/
- Use the community search results for external validation and competitive analysis
- Always include `sources` array entries with `label` and `url` pointing to the specific GitHub file
- Mark confidence as "high" when data comes from fetched files, "medium" from search/inference, "low" when guessing

**Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/deep-dive-analyzer-v2.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/deep-dive-analyzer-v2.ts lib/__tests__/deep-dive-analyzer-v2.test.ts
git commit -m "feat: add V2 deep dive analyzer with parallel LLM calls"
```

---

## Task 4: Update Zustand Store for V2 State

**Files:**
- Modify: `stores/scout-store.ts`
- Test: `stores/__tests__/scout-store.test.ts`

**Step 1: Write the failing test**

Add to `stores/__tests__/scout-store.test.ts`:

```typescript
describe("V2 deep dive state", () => {
  it("stores deepDiveResultsV2 separately from V1", () => {
    const { result } = renderHook(() => useScoutStore());
    expect(result.current.deepDiveResultsV2).toEqual([]);
  });

  it("addDeepDiveResultV2 appends to V2 array", () => {
    const { result } = renderHook(() => useScoutStore());
    const mockResult = { repo_url: "https://github.com/test/repo" } as DeepDiveResultV2;
    act(() => result.current.addDeepDiveResultV2(mockResult));
    expect(result.current.deepDiveResultsV2).toHaveLength(1);
  });

  it("setSummaryV2 stores V2 summary", () => {
    const { result } = renderHook(() => useScoutStore());
    const mockSummary = { takeaways: ["insight"] } as ScoutSummaryV2;
    act(() => result.current.setSummaryV2(mockSummary));
    expect(result.current.summaryV2?.takeaways).toEqual(["insight"]);
  });

  it("setDeepDivePageReady tracks navigation readiness", () => {
    const { result } = renderHook(() => useScoutStore());
    act(() => result.current.setDeepDivePageReady(true));
    expect(result.current.deepDivePageReady).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run stores/__tests__/scout-store.test.ts`
Expected: FAIL — properties not found

**Step 3: Add V2 state and actions to store**

In `stores/scout-store.ts`, add to the state interface and `create()`:

```typescript
// Add to state interface
deepDiveResultsV2: DeepDiveResultV2[];
summaryV2: ScoutSummaryV2 | null;
deepDivePageReady: boolean;

// Add to actions
addDeepDiveResultV2: (result: DeepDiveResultV2) => void;
setSummaryV2: (summary: ScoutSummaryV2) => void;
setDeepDivePageReady: (ready: boolean) => void;
```

Add to `create()` initial state:
```typescript
deepDiveResultsV2: [],
summaryV2: null,
deepDivePageReady: false,
```

Add action implementations:
```typescript
addDeepDiveResultV2: (result) =>
  set((s) => ({ deepDiveResultsV2: [...s.deepDiveResultsV2, result] })),
setSummaryV2: (summary) => set({ summaryV2: summary }),
setDeepDivePageReady: (ready) => set({ deepDivePageReady: ready }),
```

Also update `resetSearch` to clear V2 state.

**Step 4: Run test to verify it passes**

Run: `npx vitest run stores/__tests__/scout-store.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add stores/scout-store.ts stores/__tests__/scout-store.test.ts
git commit -m "feat: add V2 deep dive state to Zustand store"
```

---

## Task 5: Create V2 Deep Dive API Route

**Files:**
- Create: `app/api/scout/[id]/deep-dive-v2/route.ts`

**Step 1: Create the SSE streaming endpoint**

Create `app/api/scout/[id]/deep-dive-v2/route.ts`. This route:

1. Validates search ownership (same pattern as existing deep dive route)
2. Accepts `{ repo_urls: string[], precomputed_results?: DeepDiveResultV2[] }`
3. Re-emits precomputed results immediately as `deep_dive_complete_v2` events
4. For missing repos:
   a. Emits `deep_dive_fetch_start` — "Fetching data for {repo}..."
   b. Calls `fetchRepoData()` for each repo (parallel)
   c. Emits `deep_dive_analyze_start` — "Analyzing {repo}..."
   d. Calls `analyzeRepoV2()` for each repo (parallel — this internally fires 4 LLM calls)
   e. Emits `deep_dive_complete_v2` with result
5. After all repos complete:
   a. Generates V2 summary via `buildSummaryPromptV2()` + `callLLMWithTools()`
   b. Emits `summary_v2` event
6. Marks `phase2_complete` in Supabase
7. Safe-closes the stream

Use the `safeClose` pattern from the existing `app/api/scout/[id]/deep-dive/route.ts:90-99`.

**Step 2: Run dev server and test manually**

Run: `npm run dev -- -p 3333`
Test with curl:
```bash
curl -X POST http://localhost:3333/api/scout/TEST_SEARCH_ID/deep-dive-v2 \
  -H "Content-Type: application/json" \
  -d '{"repo_urls": ["https://github.com/vercel/next.js"]}'
```

**Step 3: Commit**

```bash
git add app/api/scout/[id]/deep-dive-v2/route.ts
git commit -m "feat: add V2 deep dive API route with parallel analysis"
```

---

## Task 6: Create `hooks/useDeepDiveStreamV2.ts`

**Files:**
- Create: `hooks/useDeepDiveStreamV2.ts`

**Step 1: Implement the V2 hook**

Create `hooks/useDeepDiveStreamV2.ts`. Follows the same pattern as `hooks/useDeepDiveStream.ts` but:

1. POSTs to `/api/scout/[id]/deep-dive-v2` instead
2. Listens for `deep_dive_complete_v2` and `summary_v2` events
3. Calls `store.addDeepDiveResultV2()` and `store.setSummaryV2()`
4. Checks DB for precomputed V2 results (look for `overview` field to detect V2 format)
5. Returns `{ startDeepDive, isStreaming, progress, error, isComplete }`

Add a `fetchPhase` state to track: `"idle" | "checking_db" | "fetching_data" | "analyzing" | "summarizing" | "complete"`

This phase info can be used by the UI to show granular progress.

**Step 2: Commit**

```bash
git add hooks/useDeepDiveStreamV2.ts
git commit -m "feat: add V2 deep dive streaming hook"
```

---

## Task 7: Build Deep Dive Page Components — Layout Shell

**Files:**
- Create: `app/scout/[id]/deep-dive/page.tsx`
- Create: `app/scout/[id]/deep-dive/DeepDivePageClient.tsx`
- Create: `components/deep-dive-page/DeepDiveHeader.tsx`
- Create: `components/deep-dive-page/DeepDiveSidebar.tsx`
- Create: `components/deep-dive-page/SectionSkeleton.tsx`

**Step 1: Create the server component page**

Create `app/scout/[id]/deep-dive/page.tsx`:

```typescript
import { use } from "react";
import { DeepDivePageClient } from "./DeepDivePageClient";

export default function DeepDivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DeepDivePageClient searchId={id} />;
}
```

**Step 2: Create the client component shell**

Create `app/scout/[id]/deep-dive/DeepDivePageClient.tsx`:

```typescript
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useScoutStore } from "@/stores/scout-store";
import { useDeepDiveStreamV2 } from "@/hooks/useDeepDiveStreamV2";
import { DeepDiveHeader } from "@/components/deep-dive-page/DeepDiveHeader";
import { DeepDiveSidebar } from "@/components/deep-dive-page/DeepDiveSidebar";
import { SectionSkeleton } from "@/components/deep-dive-page/SectionSkeleton";
// More component imports as they are built in later tasks...

interface DeepDivePageClientProps {
  searchId: string;
}

export function DeepDivePageClient({ searchId }: DeepDivePageClientProps) {
  const router = useRouter();
  const selectedRepoUrls = useScoutStore((s) => s.selectedRepoUrls);
  const searchMeta = useScoutStore((s) => s.searchMeta);
  const deepDiveResultsV2 = useScoutStore((s) => s.deepDiveResultsV2);
  const summaryV2 = useScoutStore((s) => s.summaryV2);
  const { startDeepDive, isStreaming, progress, error, isComplete } =
    useDeepDiveStreamV2(searchId);

  // On mount: if no selected URLs in store, redirect back
  useEffect(() => {
    if (selectedRepoUrls.length === 0 && deepDiveResultsV2.length === 0) {
      // Try to load from DB first, otherwise redirect
      router.push(`/scout/${searchId}`);
    }
  }, []);

  // Auto-start deep dive if not already complete
  useEffect(() => {
    if (selectedRepoUrls.length > 0 && deepDiveResultsV2.length === 0 && !isStreaming) {
      startDeepDive(selectedRepoUrls);
    }
  }, [selectedRepoUrls]);

  // Build sidebar sections for IntersectionObserver tracking
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  const handleBack = () => router.push(`/scout/${searchId}`);

  return (
    <div className="min-h-screen bg-background">
      <DeepDiveHeader
        onBack={handleBack}
        query={searchMeta?.query || ""}
        repoCount={selectedRepoUrls.length}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[200px_1fr] lg:gap-8">
        {/* Sticky sidebar */}
        <DeepDiveSidebar
          repos={deepDiveResultsV2}
          selectedUrls={selectedRepoUrls}
          isComplete={isComplete}
        />

        {/* Main content */}
        <main className="space-y-8">
          {/* Progress indicator during streaming */}
          {isStreaming && (
            <div className="rounded-lg border border-teal/20 bg-teal/5 px-5 py-4 text-sm text-muted-foreground" role="status">
              Analyzing {progress.completed} of {progress.total} repositories...
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Executive Summary placeholder */}
          <section id="overview">
            {isComplete && summaryV2 ? (
              <div>/* ExecutiveSummary component — Task 9 */</div>
            ) : (
              <SectionSkeleton title="Executive Summary" />
            )}
          </section>

          {/* Comparative Matrix placeholder */}
          <section id="compare">
            {isComplete && summaryV2 ? (
              <div>/* ComparativeMatrix component — Task 9 */</div>
            ) : (
              <SectionSkeleton title="Comparative Matrix" />
            )}
          </section>

          {/* Per-repo analysis cards */}
          {selectedRepoUrls.map((url) => {
            const result = deepDiveResultsV2.find((r) => r.repo_url === url);
            return (
              <section key={url} id={`repo-${url.split("/").slice(-2).join("-")}`}>
                {result ? (
                  <div>/* RepoAnalysisCard component — Task 8 */</div>
                ) : (
                  <SectionSkeleton title={url.replace("https://github.com/", "")} />
                )}
              </section>
            );
          })}

          {/* Ecosystem Gaps placeholder */}
          <section id="gaps">
            {isComplete && summaryV2 ? (
              <div>/* EcosystemGaps component — Task 9 */</div>
            ) : (
              <SectionSkeleton title="Ecosystem Gaps" />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
```

**Step 3: Create DeepDiveHeader**

Create `components/deep-dive-page/DeepDiveHeader.tsx`:

```typescript
"use client";

import { ArrowLeft } from "lucide-react";

interface DeepDiveHeaderProps {
  onBack: () => void;
  query: string;
  repoCount: number;
}

export function DeepDiveHeader({ onBack, query, repoCount }: DeepDiveHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Results
        </button>
        <div className="flex-1 text-center">
          <h1 className="font-serif text-xl text-foreground">Deep Dive Report</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {query} &middot; {repoCount} {repoCount === 1 ? "repo" : "repos"}
          </p>
        </div>
        <div className="w-[100px]" /> {/* Balance the back button */}
      </div>
    </header>
  );
}
```

**Step 4: Create DeepDiveSidebar**

Create `components/deep-dive-page/DeepDiveSidebar.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import type { DeepDiveResultV2 } from "@/lib/types";

interface DeepDiveSidebarProps {
  repos: DeepDiveResultV2[];
  selectedUrls: string[];
  isComplete: boolean;
}

export function DeepDiveSidebar({ repos, selectedUrls, isComplete }: DeepDiveSidebarProps) {
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-100px 0px -60% 0px" }
    );

    const sections = document.querySelectorAll("section[id]");
    sections.forEach((s) => observer.observe(s));

    return () => observer.disconnect();
  }, [repos.length, isComplete]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const navItems = [
    { id: "overview", label: "Overview" },
    { id: "compare", label: "Compare" },
    ...selectedUrls.map((url) => ({
      id: `repo-${url.split("/").slice(-2).join("-")}`,
      label: url.replace("https://github.com/", ""),
    })),
    { id: "gaps", label: "Gaps" },
  ];

  return (
    <nav className="hidden lg:block" aria-label="Page navigation">
      <div className="sticky top-16 space-y-1">
        {navItems.map((item, i) => {
          const isRepo = i >= 2 && i < navItems.length - 1;
          return (
            <div key={item.id}>
              {i === 2 && <div className="my-2 border-t border-border/50" />}
              {i === navItems.length - 1 && <div className="my-2 border-t border-border/50" />}
              <button
                type="button"
                onClick={() => scrollTo(item.id)}
                className={`w-full truncate rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                  activeSection === item.id
                    ? "bg-teal/10 font-medium text-teal"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                } ${isRepo ? "text-xs" : ""}`}
              >
                {item.label}
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
```

**Step 5: Create SectionSkeleton**

Create `components/deep-dive-page/SectionSkeleton.tsx`:

```typescript
interface SectionSkeletonProps {
  title: string;
}

export function SectionSkeleton({ title }: SectionSkeletonProps) {
  return (
    <div className="animate-pulse rounded-lg border border-border/50 bg-card p-6 space-y-4">
      <h3 className="font-serif text-lg text-muted-foreground/50">{title}</h3>
      <div className="space-y-3">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
      </div>
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add app/scout/[id]/deep-dive/ components/deep-dive-page/
git commit -m "feat: add deep dive page shell with header, sidebar, and skeletons"
```

---

## Task 8: Build `RepoAnalysisCard` Component (12 Sections)

**Files:**
- Create: `components/deep-dive-page/RepoAnalysisCard.tsx`
- Create: `components/deep-dive-page/SourceLink.tsx`
- Create: `components/deep-dive-page/sections/OverviewSection.tsx`
- Create: `components/deep-dive-page/sections/TechStackSectionV2.tsx`
- Create: `components/deep-dive-page/sections/CodeQualitySection.tsx`
- Create: `components/deep-dive-page/sections/CommunityHealthSection.tsx`
- Create: `components/deep-dive-page/sections/DocumentationSection.tsx`
- Create: `components/deep-dive-page/sections/SecuritySection.tsx`
- Create: `components/deep-dive-page/sections/GettingStartedSection.tsx`

**Step 1: Create SourceLink component**

Create `components/deep-dive-page/SourceLink.tsx`:

```typescript
import { ExternalLink } from "lucide-react";
import type { SourceLink as SourceLinkType } from "@/lib/types";

export function SourceLink({ label, url }: SourceLinkType) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded bg-teal/10 px-1.5 py-0.5 text-xs font-medium text-teal transition-colors hover:bg-teal/20"
    >
      {label}
      <ExternalLink className="size-3" aria-hidden="true" />
    </a>
  );
}
```

**Step 2: Create each section component**

Each section component receives its typed data from `DeepDiveResultV2` and renders it with:
- Section heading with `ConfidenceIndicator` badge
- Multi-paragraph content
- Inline `SourceLink` components for verifiable claims
- Section-specific UI (badges, lists, status indicators)

Example pattern for `CodeQualitySection.tsx`:

```typescript
import { ConfidenceIndicator } from "@/components/deep-dive/ConfidenceIndicator";
import { SourceLink } from "../SourceLink";
import { CheckCircle2, XCircle } from "lucide-react";
import type { CodeQuality } from "@/lib/types";

interface CodeQualitySectionProps {
  data: CodeQuality;
}

export function CodeQualitySection({ data }: CodeQualitySectionProps) {
  const indicators = [
    { label: "Tests", value: data.has_tests, detail: data.test_framework },
    { label: "CI/CD", value: data.has_ci, detail: data.ci_platform },
    { label: "Linting", value: data.has_linting, detail: data.linter },
    { label: "TypeScript Strict", value: data.typescript_strict },
    { label: "Coverage", value: data.code_coverage_mentioned },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="font-serif text-lg">Code Quality</h4>
        <ConfidenceIndicator level={data.confidence} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {indicators.map((ind) => (
          <div key={ind.label} className="flex items-center gap-2 rounded-md border border-border/50 px-3 py-2 text-sm">
            {ind.value ? (
              <CheckCircle2 className="size-4 text-emerald-600" />
            ) : (
              <XCircle className="size-4 text-muted-foreground/40" />
            )}
            <span>{ind.label}</span>
            {ind.detail && (
              <span className="text-xs text-muted-foreground">({ind.detail})</span>
            )}
          </div>
        ))}
      </div>
      {data.build_system && (
        <p className="text-sm text-muted-foreground">Build system: {data.build_system}</p>
      )}
      {data.sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.sources.map((s) => <SourceLink key={s.url} {...s} />)}
        </div>
      )}
    </div>
  );
}
```

Follow the same pattern for all section components. Reuse existing `ConfidenceIndicator`, `AIPatternsSection` (enhanced), and `SkillsSection` components where possible.

**Step 3: Create RepoAnalysisCard**

Create `components/deep-dive-page/RepoAnalysisCard.tsx` that renders all 12 sections for a single repo. No collapsible accordions — everything is expanded:

```typescript
import type { DeepDiveResultV2, ScoutMode } from "@/lib/types";
import { Star, Users, Scale, Code2, Calendar } from "lucide-react";
// Import all section components...

interface RepoAnalysisCardProps {
  result: DeepDiveResultV2;
  mode: ScoutMode;
  index: number;
}

export function RepoAnalysisCard({ result, mode, index }: RepoAnalysisCardProps) {
  return (
    <article className="rounded-lg border border-border/50 bg-card animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
      {/* Header: repo name, stars, lang, license, contributors, last updated */}
      <div className="border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl">
            <a href={result.repo_url} target="_blank" rel="noopener noreferrer" className="hover:text-teal transition-colors">
              {result.repo_name}
            </a>
          </h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Star className="size-3.5" />{result.stars.toLocaleString()}</span>
            {result.contributors && <span className="flex items-center gap-1"><Users className="size-3.5" />{result.contributors}</span>}
            <span className="flex items-center gap-1"><Code2 className="size-3.5" />{result.primary_language}</span>
            <span className="flex items-center gap-1"><Scale className="size-3.5" />{result.license}</span>
          </div>
        </div>
      </div>

      {/* 12 sections rendered in order */}
      <div className="divide-y divide-border/30 px-6">
        {/* 1. Overview */}
        <div className="py-5"><OverviewSection data={result.overview} /></div>
        {/* 2. Why It Stands Out */}
        <div className="py-5"><EnhancedSectionDisplay data={result.why_it_stands_out} /></div>
        {/* 3. Tech Stack */}
        <div className="py-5"><TechStackSectionV2 data={result.tech_stack} /></div>
        {/* 4. Architecture */}
        <div className="py-5"><EnhancedSectionDisplay data={result.architecture} /></div>
        {/* 5. Code Quality */}
        <div className="py-5"><CodeQualitySection data={result.code_quality} /></div>
        {/* 6. Community Health */}
        <div className="py-5"><CommunityHealthSection data={result.community_health} /></div>
        {/* 7. Documentation */}
        <div className="py-5"><DocumentationSection data={result.documentation_quality} /></div>
        {/* 8. Security */}
        <div className="py-5"><SecuritySection data={result.security_posture} /></div>
        {/* 9. AI Patterns */}
        <div className="py-5"><AIPatternsSection patterns={result.ai_patterns} /></div>
        {/* 10. Skills Required */}
        <div className="py-5"><SkillsSection skills={result.skills_required} /></div>
        {/* 11. Getting Started */}
        <div className="py-5"><GettingStartedSection data={result.getting_started} /></div>
        {/* 12. Mode-Specific */}
        <div className="py-5"><EnhancedSectionDisplay data={result.mode_specific} /></div>
      </div>
    </article>
  );
}
```

**Step 4: Commit**

```bash
git add components/deep-dive-page/
git commit -m "feat: add RepoAnalysisCard with 12 sections and SourceLink component"
```

---

## Task 9: Build Executive Summary, Comparative Matrix, and Ecosystem Gaps Components

**Files:**
- Create: `components/deep-dive-page/ExecutiveSummary.tsx`
- Create: `components/deep-dive-page/ComparativeMatrix.tsx`
- Create: `components/deep-dive-page/EcosystemGaps.tsx`

**Step 1: Build ExecutiveSummary**

Renders: takeaways (numbered list with teal badges), top recommendation (card with link), skills roadmap (visual stepped pathway), AI ecosystem notes.

Use `ScoutSummaryV2` type. Same design language as existing `SummaryPanel.tsx` but richer.

**Step 2: Build ComparativeMatrix**

Renders a responsive HTML table comparing repos across dimensions from `summaryV2.comparative_matrix`. Each cell links to the relevant repo section via `scrollTo()`.

**Step 3: Build EcosystemGaps**

Renders `summaryV2.ecosystem_gaps` array with gap + opportunity pairs. Yellow/amber alert styling.

**Step 4: Commit**

```bash
git add components/deep-dive-page/ExecutiveSummary.tsx components/deep-dive-page/ComparativeMatrix.tsx components/deep-dive-page/EcosystemGaps.tsx
git commit -m "feat: add executive summary, comparative matrix, and ecosystem gaps components"
```

---

## Task 10: Wire Components into DeepDivePageClient

**Files:**
- Modify: `app/scout/[id]/deep-dive/DeepDivePageClient.tsx`

**Step 1: Replace placeholder divs with real components**

Import and render:
- `ExecutiveSummary` in the `#overview` section
- `ComparativeMatrix` in the `#compare` section
- `RepoAnalysisCard` for each completed repo
- `EcosystemGaps` in the `#gaps` section

**Step 2: Run dev server and test manually**

Run: `npm run dev -- -p 3333`
Navigate to a completed search, select repos, click deep dive, verify the page renders.

**Step 3: Commit**

```bash
git add app/scout/[id]/deep-dive/DeepDivePageClient.tsx
git commit -m "feat: wire all deep dive page components together"
```

---

## Task 11: Update Search Results Page — Navigation + Idempotency

**Files:**
- Modify: `app/scout/[id]/ScoutResultsClient.tsx:87-95, 226-261`
- Modify: `components/results/DeepDiveCTA.tsx`

**Step 1: Update handleDeepDive to navigate**

In `ScoutResultsClient.tsx`, change `handleDeepDive()` (line 87-95) from:

```typescript
const handleDeepDive = () => {
  startDeepDive(selectedRepoUrls);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      deepDiveRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
};
```

To:

```typescript
const handleDeepDive = () => {
  router.push(`/scout/${searchId}/deep-dive`);
};
```

Add `import { useRouter } from "next/navigation";` and `const router = useRouter();`.

**Step 2: Remove inline deep dive rendering**

Remove the deep dive results section (lines 226-256) and the `deepDiveRef`. Keep the `DeepDiveCTA` but remove the `useDeepDiveStream` hook import (no longer needed on this page).

**Step 3: Update DeepDiveCTA for idempotency**

In `DeepDiveCTA.tsx`, check if deep dive results already exist in the store. If so, change button text to "View Deep Dive" and skip the loading state.

```typescript
const deepDiveResultsV2 = useScoutStore((s) => s.deepDiveResultsV2);
const hasExistingResults = deepDiveResultsV2.length > 0;

// Button text:
// hasExistingResults → "View Deep Dive Report"
// isDeepDiving → "Analyzing..."
// default → "Deep Dive Selected (X/5)"
```

**Step 4: Run dev server and test the full flow**

Run: `npm run dev -- -p 3333`
1. Perform a search
2. Select repos
3. Click "Deep Dive" → should navigate to `/scout/[id]/deep-dive`
4. Back button → should return to search results
5. Click "Deep Dive" again → should show "View Deep Dive Report" and navigate without re-analysis

**Step 5: Commit**

```bash
git add app/scout/[id]/ScoutResultsClient.tsx components/results/DeepDiveCTA.tsx
git commit -m "feat: update search results page to navigate to deep dive page"
```

---

## Task 12: Update Background Precompute to Use V2 Analyzer

**Files:**
- Modify: `app/api/scout/route.ts` (the GET handler, around line 498-506)

**Step 1: Switch precompute to V2**

In `app/api/scout/route.ts`, change the background precompute from:

```typescript
import { analyzeRepo } from "@/lib/deep-dive-analyzer";
// ...
Promise.allSettled(urls.map((url) => analyzeRepo(url, searchId)))
```

To:

```typescript
import { analyzeRepoV2 } from "@/lib/deep-dive-analyzer-v2";
// ...
Promise.allSettled(urls.map((url) => analyzeRepoV2(url, searchId)))
```

**Step 2: Commit**

```bash
git add app/api/scout/route.ts
git commit -m "feat: switch background precompute to V2 analyzer"
```

---

## Task 13: Run All Tests and Fix Regressions

**Files:**
- All test files

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (46 existing + new V2 tests)

**Step 2: Fix any failures**

Address import path issues, type mismatches, or mock updates needed for existing tests.

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve test regressions from V2 deep dive integration"
```

---

## Task 14: End-to-End Manual Testing

**Step 1: Start dev server**

Run: `npm run dev -- -p 3333`

**Step 2: Test complete flow**

1. Go to `http://localhost:3333`
2. Enter a search query (e.g., "AI coding agents")
3. Wait for Phase 1 to complete
4. Select 2-3 repos
5. Click "Deep Dive Selected"
6. Verify navigation to `/scout/[id]/deep-dive`
7. Verify progressive reveal (skeletons → filled sections)
8. Verify sidebar navigation (click items, check active highlighting)
9. Verify inline source links are clickable and point to real GitHub files
10. Verify executive summary renders after all repos complete
11. Verify comparative matrix renders with correct data
12. Click "Back to Results" and verify search results page intact
13. Click "Deep Dive" again — should show "View Deep Dive Report" and load instantly from store

**Step 3: Test edge cases**

- Direct URL access: navigate to `/scout/[id]/deep-dive` without going through search first
- Refresh the deep dive page — should reload from DB
- Mobile viewport — sidebar should collapse

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: polish deep dive page from manual testing"
```

---

## Summary

| Task | Description | Estimated Steps |
|------|-------------|-----------------|
| 1 | V2 types | 5 |
| 2 | Parallel data fetcher | 5 |
| 3 | V2 analyzer (parallel LLM) | 5 |
| 4 | Zustand store updates | 5 |
| 5 | V2 API route | 3 |
| 6 | V2 streaming hook | 2 |
| 7 | Page shell + layout | 6 |
| 8 | RepoAnalysisCard (12 sections) | 4 |
| 9 | Summary + Matrix + Gaps | 4 |
| 10 | Wire components | 3 |
| 11 | Search results page updates | 5 |
| 12 | Background precompute V2 | 2 |
| 13 | Test regressions | 3 |
| 14 | E2E manual testing | 4 |
| **Total** | | **56 steps** |
