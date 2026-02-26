# Agent Ecosystem Discovery — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add batch web search for real agent config files (.cursorrules, mcp.json, skills.yaml, .claude) during deep dive analysis, injecting discovered data as context into Group C for grounded skill recommendations.

**Architecture:** Before the 4-group parallel LLM calls, a new `batchSearchAgentEcosystem()` function runs 1-2 Serper queries to find real agent config files across all repos being analyzed. Results are injected as additional context into Group C's prompt. Group C stays pure completion (`maxToolRounds: 0`).

**Tech Stack:** Next.js, TypeScript, Serper API, MiniMax M2.5, Tailwind CSS, shadcn/ui, Vitest

---

### Task 1: Add AgentEcosystemDiscovery type to lib/types.ts

**Files:**
- Modify: `lib/types.ts:222-230`
- Test: `lib/__tests__/deep-dive-analyzer-v2.test.ts`

**Step 1: Add the new type and update DeepDiveResultV2**

Add after line 197 (after `GettingStarted` interface), before `DeepDiveResultV2`:

```typescript
export interface AgentEcosystemDiscovery {
  discovered_files: Array<{
    type: "cursorrules" | "mcp_config" | "claude_skills" | "agents_config" | "other";
    path: string;
    url: string;
    summary: string;
  }>;
  ecosystem_mapping: {
    cursor: { has_config: boolean; rules_count: number };
    claude: { has_skills: boolean; has_mcp: boolean };
    other_agents: string[];
  };
  trending_tools: Array<{
    name: string;
    relevance: string;
    url?: string;
  }>;
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}
```

Then add to `DeepDiveResultV2` after `skills_required` (line 227):

```typescript
  agent_ecosystem: AgentEcosystemDiscovery;
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Errors in files that construct `DeepDiveResultV2` (deep-dive-analyzer-v2.ts, test file) — these are expected and will be fixed in subsequent tasks.

**Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add AgentEcosystemDiscovery type to DeepDiveResultV2"
```

---

### Task 2: Add batchSearchAgentEcosystem() function

**Files:**
- Modify: `lib/deep-dive-analyzer-v2.ts:1-5` (imports), new function before `analyzeRepoV2`
- Test: `lib/__tests__/deep-dive-analyzer-v2.test.ts`

**Step 1: Write the failing test**

Add to `lib/__tests__/deep-dive-analyzer-v2.test.ts`:

```typescript
// Add webSearch mock at top alongside existing mocks
vi.mock("../web-search", () => ({
  webSearch: vi.fn(),
  fetchWebPage: vi.fn(),
}));

import { webSearch, fetchWebPage } from "../web-search";
const mockedWebSearch = vi.mocked(webSearch);
const mockedFetchWebPage = vi.mocked(fetchWebPage);
```

Add new test inside the describe block:

```typescript
describe("batchSearchAgentEcosystem", () => {
  beforeEach(() => {
    mockedWebSearch.mockResolvedValue([]);
    mockedFetchWebPage.mockResolvedValue("");
  });

  it("returns empty map when no agent files found", async () => {
    mockedWebSearch.mockResolvedValue([]);

    const result = await analyzeRepoV2("https://github.com/test/repo", "search-123");

    // The agent_ecosystem field should exist with empty defaults
    expect(result.agent_ecosystem).toBeDefined();
    expect(result.agent_ecosystem.discovered_files).toEqual([]);
    expect(result.agent_ecosystem.ecosystem_mapping.cursor.has_config).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/deep-dive-analyzer-v2.test.ts --reporter=verbose`
Expected: FAIL — `agent_ecosystem` property doesn't exist on the result yet.

**Step 3: Implement batchSearchAgentEcosystem()**

Add import at top of `lib/deep-dive-analyzer-v2.ts`:

```typescript
import { webSearch, fetchWebPage } from "@/lib/web-search";
```

Add this type and function before `analyzeRepoV2`:

```typescript
// ── Agent ecosystem batch search ─────────────────────────────────

interface AgentEcosystemRaw {
  fileUrls: Array<{ type: string; url: string; path: string }>;
  fileContents: Map<string, string>;
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

  try {
    // Build a single Serper query for all repos
    const repoTerms = repos
      .slice(0, 6) // Limit to avoid overly long queries
      .map((r) => `"${r.owner}/${r.repo}"`)
      .join(" OR ");
    const fileTerms = AGENT_FILE_PATTERNS.map((f) => `"${f}"`).join(" OR ");
    const query = `site:github.com (${fileTerms}) ${repoTerms}`;

    // Fire file discovery search (trending search skipped for v1 — use raw Serper results)
    const searchResults = await webSearch(query, 20);

    // Group results by repo
    for (const r of repos) {
      result.set(r.repoUrl, { fileUrls: [], fileContents: new Map(), trendingResults: [] });
    }

    for (const hit of searchResults) {
      // Match hit URL to a repo
      const matchedRepo = repos.find(
        (r) => hit.url.includes(`${r.owner}/${r.repo}`)
      );
      if (!matchedRepo) continue;

      // Detect file type from URL
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

    // Fetch discovered file contents in parallel (max 5 to limit latency)
    const fetchPromises: Array<Promise<void>> = [];
    for (const [repoUrl, data] of result) {
      for (const file of data.fileUrls.slice(0, 3)) {
        // Convert blob URL to raw URL for fetching
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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/deep-dive-analyzer-v2.test.ts --reporter=verbose`
Expected: Still failing — we haven't wired it into `analyzeRepoV2` yet. That's Task 3.

**Step 5: Commit**

```bash
git add lib/deep-dive-analyzer-v2.ts lib/__tests__/deep-dive-analyzer-v2.test.ts
git commit -m "feat: add batchSearchAgentEcosystem function for agent file discovery"
```

---

### Task 3: Wire batch search into analyzeRepoV2 + parse agent_ecosystem

**Files:**
- Modify: `lib/deep-dive-analyzer-v2.ts:362-449` (analyzeRepoV2 function)
- Modify: `lib/deep-dive-analyzer-v2.ts:129-156` (buildGroupCPrompt — add ecosystem context param)
- Modify: `lib/deep-dive-analyzer-v2.ts:333-358` (buildFallbackResultV2 — add agent_ecosystem)

**Step 1: Add import for the new type**

At the top of `lib/deep-dive-analyzer-v2.ts`, add `AgentEcosystemDiscovery` to the imports from `@/lib/types`.

**Step 2: Update buildGroupCPrompt to accept ecosystem context**

Change the function signature to accept an optional ecosystem context string:

```typescript
function buildGroupCPrompt(data: RawRepoData, ecosystemContext?: string): { systemPrompt: string; userMessage: string } {
```

Add to the system prompt (after the AI Pattern indicators section, before "Return a JSON object"):

```
${ecosystemContext ? `
AGENT ECOSYSTEM DATA (from web search — these are REAL files found on GitHub for this repo):
${ecosystemContext}

Use this real data to populate the "agent_ecosystem" field. Report what was ACTUALLY FOUND, not guesses.
If no agent files were found, set discovered_files to empty array and has_config/has_skills to false.
` : ""}
```

Add to the JSON schema in the prompt (after `mode_specific`):

```json
,
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
```

**Step 3: Add parseAgentEcosystem parser**

Add after `parseAIPatternsV2` function:

```typescript
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
```

**Step 4: Update analyzeRepoV2 to call batch search and pass context**

In `analyzeRepoV2`, after `const data = await fetchRepoData(repoUrl);` and before the 4 parallel LLM calls:

```typescript
    // Phase 1.5: Batch search for agent ecosystem files
    const repoInfo = { owner: data.owner, repo: data.repo, repoUrl };
    const ecosystemMap = await batchSearchAgentEcosystem([repoInfo]);
    const ecosystemData = ecosystemMap.get(repoUrl);
    let ecosystemContext: string | undefined;
    if (ecosystemData && ecosystemData.fileUrls.length > 0) {
      const contextParts: string[] = [];
      for (const file of ecosystemData.fileUrls) {
        const content = ecosystemData.fileContents.get(file.path);
        contextParts.push(`File: ${file.path} (${file.type})\nURL: ${file.url}${content ? `\nContent:\n${content}` : ""}`);
      }
      ecosystemContext = contextParts.join("\n---\n");
    }
```

Update the Group C prompt call:

```typescript
    const promptC = buildGroupCPrompt(data, ecosystemContext);
```

In the result construction, after `skills_required`:

```typescript
      agent_ecosystem: parseAgentEcosystem(parsedC.agent_ecosystem),
```

**Step 5: Update buildFallbackResultV2 to include agent_ecosystem**

Add to the fallback object after `skills_required`:

```typescript
    agent_ecosystem: { discovered_files: [], ecosystem_mapping: { cursor: { has_config: false, rules_count: 0 }, claude: { has_skills: false, has_mcp: false }, other_agents: [] }, trending_tools: [], confidence: "low", sources: [] },
```

**Step 6: Update test mock to include agent_ecosystem in LLM response**

In `lib/__tests__/deep-dive-analyzer-v2.test.ts`, add to the `mockedLLM.mockResolvedValue` JSON:

```typescript
      agent_ecosystem: { discovered_files: [], ecosystem_mapping: { cursor: { has_config: false, rules_count: 0 }, claude: { has_skills: false, has_mcp: false }, other_agents: [] }, trending_tools: [], confidence: "low", sources: [] },
```

Also add the web-search mock defaults in the top-level `beforeEach`:

```typescript
    mockedWebSearch.mockResolvedValue([]);
    mockedFetchWebPage.mockResolvedValue("");
```

**Step 7: Run tests**

Run: `npx vitest run lib/__tests__/deep-dive-analyzer-v2.test.ts --reporter=verbose`
Expected: ALL PASS

**Step 8: Run TypeScript compilation check**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Errors only in UI components (RepoAnalysisCard) that need the new field — fixed in Task 5.

**Step 9: Commit**

```bash
git add lib/deep-dive-analyzer-v2.ts lib/__tests__/deep-dive-analyzer-v2.test.ts
git commit -m "feat: wire batch agent ecosystem search into analyzeRepoV2 pipeline"
```

---

### Task 4: Create AgentEcosystemSection UI component

**Files:**
- Create: `components/deep-dive/AgentEcosystemSection.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { ExternalLink, FileCode2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfidenceIndicator } from "./ConfidenceIndicator";
import type { AgentEcosystemDiscovery } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AgentEcosystemSectionProps {
  ecosystem: AgentEcosystemDiscovery;
}

const fileTypeLabels: Record<string, string> = {
  cursorrules: "Cursor Rules",
  mcp_config: "MCP Config",
  claude_skills: "Claude Skills",
  agents_config: "Agent Config",
  other: "Config File",
};

const platformBadges = [
  { key: "cursor" as const, label: "Cursor", check: (e: AgentEcosystemDiscovery) => e.ecosystem_mapping.cursor.has_config },
  { key: "claude" as const, label: "Claude", check: (e: AgentEcosystemDiscovery) => e.ecosystem_mapping.claude.has_skills || e.ecosystem_mapping.claude.has_mcp },
  { key: "mcp" as const, label: "MCP", check: (e: AgentEcosystemDiscovery) => e.ecosystem_mapping.claude.has_mcp },
];

export function AgentEcosystemSection({ ecosystem }: AgentEcosystemSectionProps) {
  const hasContent =
    ecosystem.discovered_files.length > 0 ||
    ecosystem.trending_tools.length > 0 ||
    ecosystem.ecosystem_mapping.other_agents.length > 0;

  if (!hasContent) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h4 className="flex items-center gap-2 font-serif text-lg text-foreground">
          <Search className="size-4 text-teal" />
          Agent Ecosystem Discovery
        </h4>
        <ConfidenceIndicator confidence={ecosystem.confidence} />
      </div>

      <div className="rounded-lg border border-teal/20 bg-teal/[0.03] p-4 space-y-5">
        {/* Discovered Files */}
        {ecosystem.discovered_files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <FileCode2 className="size-3.5" />
              Discovered Files
            </div>
            <div className="space-y-2">
              {ecosystem.discovered_files.map((file) => (
                <div
                  key={file.url}
                  className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-background/80 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-teal">{file.path}</code>
                      <Badge variant="outline" className="text-[10px] border-border bg-muted/50 text-muted-foreground">
                        {fileTypeLabels[file.type] || file.type}
                      </Badge>
                    </div>
                    {file.summary && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{file.summary}</p>
                    )}
                  </div>
                  {file.url && (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground/50 hover:text-teal transition-colors"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Platform Support */}
        {(ecosystem.ecosystem_mapping.cursor.has_config ||
          ecosystem.ecosystem_mapping.claude.has_skills ||
          ecosystem.ecosystem_mapping.claude.has_mcp ||
          ecosystem.ecosystem_mapping.other_agents.length > 0) && (
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Platform Support
            </div>
            <div className="flex flex-wrap gap-1.5">
              {platformBadges.map(({ key, label, check }) => {
                const active = check(ecosystem);
                return (
                  <Badge
                    key={key}
                    variant="outline"
                    className={cn(
                      "text-xs font-medium",
                      active
                        ? "border-teal/30 bg-teal/10 text-teal"
                        : "border-border bg-muted/50 text-muted-foreground/50"
                    )}
                  >
                    {label} {active ? "\u2713" : "\u2717"}
                  </Badge>
                );
              })}
              {ecosystem.ecosystem_mapping.other_agents.map((agent) => (
                <Badge
                  key={agent}
                  variant="outline"
                  className="text-xs font-medium border-teal/30 bg-teal/10 text-teal"
                >
                  {agent}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Trending in This Stack */}
        {ecosystem.trending_tools.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Trending in This Stack
            </div>
            <ul className="space-y-1.5">
              {ecosystem.trending_tools.map((tool) => (
                <li key={tool.name} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-teal/60" />
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">{tool.name}</span>
                    {" \u2014 "}
                    {tool.relevance}
                  </span>
                  {tool.url && (
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground/50 hover:text-teal transition-colors"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify no TypeScript errors in the component**

Run: `npx tsc --noEmit --strict components/deep-dive/AgentEcosystemSection.tsx 2>&1 | head -20`

**Step 3: Commit**

```bash
git add components/deep-dive/AgentEcosystemSection.tsx
git commit -m "feat: add AgentEcosystemSection component for displaying discovered agent files"
```

---

### Task 5: Wire AgentEcosystemSection into RepoAnalysisCard

**Files:**
- Modify: `components/deep-dive-page/RepoAnalysisCard.tsx:15-16` (add import), `:205-208` (add section)

**Step 1: Add import**

After the `SkillsSection` import (line 16), add:

```typescript
import { AgentEcosystemSection } from "@/components/deep-dive/AgentEcosystemSection";
```

**Step 2: Add section rendering**

After the Skills Required section (after line 208 `</div>`), add:

```tsx
        {/* 10b. Agent Ecosystem */}
        {result.agent_ecosystem && (
          <div className="py-5">
            <AgentEcosystemSection ecosystem={result.agent_ecosystem} />
          </div>
        )}
```

Note: The `result.agent_ecosystem &&` guard ensures backward compatibility with any cached results that don't have this field yet.

**Step 3: Run TypeScript compilation check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS (no errors)

**Step 4: Commit**

```bash
git add components/deep-dive-page/RepoAnalysisCard.tsx
git commit -m "feat: add AgentEcosystemSection to RepoAnalysisCard deep dive display"
```

---

### Task 6: Add comprehensive tests for batch search + agent ecosystem parsing

**Files:**
- Modify: `lib/__tests__/deep-dive-analyzer-v2.test.ts`

**Step 1: Add test for batch search finding files**

```typescript
  it("includes agent_ecosystem data when batch search finds files", async () => {
    mockedWebSearch.mockResolvedValue([
      {
        title: ".cursorrules - test/repo",
        url: "https://github.com/test/repo/blob/main/.cursorrules",
        description: "Cursor rules for this project",
      },
    ]);
    mockedFetchWebPage.mockResolvedValue("Use TypeScript strict mode\nPrefer functional patterns");

    // Update Group C mock to return agent_ecosystem with discovered data
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
    // webSearch should have been called for ecosystem discovery
    expect(mockedWebSearch).toHaveBeenCalled();
  });
```

**Step 2: Add test for graceful degradation**

```typescript
  it("handles batch search failure gracefully", async () => {
    mockedWebSearch.mockRejectedValue(new Error("Serper rate limit"));

    const result = await analyzeRepoV2("https://github.com/test/repo", "search-123");

    // Should still return a valid result with empty ecosystem
    expect(result.agent_ecosystem).toBeDefined();
    expect(result.agent_ecosystem.discovered_files).toEqual([]);
  });
```

**Step 3: Run all tests**

Run: `npx vitest run lib/__tests__/deep-dive-analyzer-v2.test.ts --reporter=verbose`
Expected: ALL PASS

**Step 4: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All 84+ tests pass

**Step 5: Commit**

```bash
git add lib/__tests__/deep-dive-analyzer-v2.test.ts
git commit -m "test: add agent ecosystem discovery tests for batch search and parsing"
```

---

### Task 7: Manual E2E verification + final commit

**Files:**
- No new files. Verify integration works end-to-end.

**Step 1: Run the dev server**

Run: `npm run dev -- -p 3333`

**Step 2: Test with a real search**

Open `http://localhost:3333` and search for "frontend agent skills" or "cursor rules react projects". Watch the deep dive analysis. Verify:

1. The deep dive page loads without errors
2. Repos that have `.cursorrules` or `mcp.json` show the new "Agent Ecosystem Discovery" section
3. Repos without agent files correctly show no new section (null render)
4. The existing Skills Required and AI Patterns sections still work

**Step 3: Run full test suite one more time**

Run: `npx vitest run --reporter=verbose`
Expected: All tests pass

**Step 4: Final commit if any adjustments were needed**

```bash
git add -A
git commit -m "fix: adjustments from E2E testing of agent ecosystem discovery"
```
