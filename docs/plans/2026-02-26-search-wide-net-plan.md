# Wide Net Search Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix search discovery gaps so popular repos aren't missed, by expanding strategies, increasing result counts, enforcing parallel execution, and handling vague queries.

**Architecture:** Prompt-driven changes to the existing agentic tool loop. The LLM fires 6 parallel web_search calls in round 1 (up from 4 sequential), each returning 20 results (up from 10). Mode detection adds more trigger words and a "discover" fallback for vague queries. Adaptive `maxToolRounds` gives vague queries extra exploration rounds.

**Tech Stack:** Next.js API route, MiniMax M2.5 via OpenAI SDK, Serper API, Vitest

---

### Task 1: Expand mode detection trigger words + vague query detection

**Files:**
- Modify: `lib/mode-detection.ts`
- Test: `lib/__tests__/mode-detection.test.ts`

**Step 1: Write failing tests for new trigger words and vague query behavior**

Add to `lib/__tests__/mode-detection.test.ts`:

```typescript
it("detects SCOUT mode from tool/framework keywords", () => {
  const result = detectMode("Frontend agent framework");
  expect(result.mode).toBe("SCOUT");
  expect(result.confidence).toBeGreaterThan(0);
});

it("detects SCOUT mode from library/toolkit keywords", () => {
  const result = detectMode("best UI toolkit for React");
  expect(result.mode).toBe("SCOUT");
  expect(result.confidence).toBeGreaterThan(0);
});

it("detects BUILD mode from app/frontend keywords", () => {
  const result = detectMode("frontend application starter");
  expect(result.mode).toBe("BUILD");
  expect(result.confidence).toBeGreaterThan(0);
});

it("detects LEARN mode from skill/practice keywords", () => {
  const result = detectMode("practice coding skills");
  expect(result.mode).toBe("LEARN");
  expect(result.confidence).toBeGreaterThan(0);
});

it("detects SCOUT for compound vague queries with framework-like words", () => {
  const result = detectMode("Frontend agent skills");
  expect(result.mode).toBe("SCOUT");
  expect(result.confidence).toBeGreaterThan(0);
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/mode-detection.test.ts`
Expected: 4 of the 5 new tests FAIL (the "skills" one may pass since LEARN already has "skills for")

**Step 3: Add new trigger words to MODE_TRIGGERS**

In `lib/mode-detection.ts`, update the `MODE_TRIGGERS` constant:

```typescript
const MODE_TRIGGERS: Record<ScoutMode, string[]> = {
  LEARN: [
    "learn", "teach", "tutorial", "how to", "how do", "beginner",
    "study", "understand", "skills for", "getting started",
    "explain", "introduction", "course", "education", "practice",
    "training", "master", "skill",
  ],
  BUILD: [
    "build", "create", "make", "template", "boilerplate", "scaffold",
    "stack", "implement", "architecture", "starter", "setup",
    "deploy", "production", "project structure", "tech stack",
    "app", "application", "service", "api", "backend", "frontend",
  ],
  SCOUT: [
    "what exists", "alternatives", "compare", "comparison", "landscape",
    "trending", "overview", "tools for", "options for", "market",
    "competitors", "versus", "vs", "which is better", "what's out there",
    "framework", "library", "toolkit", "sdk", "platform", "tool",
    "agent", "plugin", "package", "module",
  ],
};
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/mode-detection.test.ts`
Expected: ALL tests PASS

**Step 5: Commit**

```bash
git add lib/mode-detection.ts lib/__tests__/mode-detection.test.ts
git commit -m "feat: expand mode detection triggers for vague queries"
```

---

### Task 2: Bump webSearch default from 10 → 20

**Files:**
- Modify: `lib/web-search.ts`
- Test: `lib/__tests__/web-search.test.ts`

**Step 1: Write failing test for new default count**

Add to `lib/__tests__/web-search.test.ts`:

```typescript
import { webSearch } from "../web-search";

describe("webSearch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to 20 results per query", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ organic: [] }),
    }));

    await webSearch("test query");

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"num":20'),
      })
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/web-search.test.ts`
Expected: FAIL — body contains `"num":10`

**Step 3: Change default count in webSearch**

In `lib/web-search.ts`, line 11, change:
```typescript
// Before:
count: number = 10
// After:
count: number = 20
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/web-search.test.ts`
Expected: ALL tests PASS

**Step 5: Commit**

```bash
git add lib/web-search.ts lib/__tests__/web-search.test.ts
git commit -m "feat: bump Serper default results from 10 to 20"
```

---

### Task 3: Update system prompt — 6 strategies + parallel instruction + verify 8-12

**Files:**
- Modify: `app/api/scout/route.ts` (the `buildSystemPrompt` function)

**Step 1: Rewrite buildSystemPrompt with 6 strategies and parallel execution instruction**

Replace the `buildSystemPrompt` function body in `app/api/scout/route.ts`:

```typescript
function buildSystemPrompt(mode: ScoutMode, isVagueQuery: boolean): string {
  const modeLabel = isVagueQuery ? `${mode} (broad discovery)` : mode;
  const modeGuidance = isVagueQuery
    ? "The query is broad — explore the ecosystem widely. Search across different angles and sub-topics rather than focusing on competitive positioning."
    : "";

  return `You are GitHub Scout, an AI-powered repository intelligence agent operating in ${modeLabel} mode.

Your job is to discover, verify, and evaluate open-source GitHub repositories for a given topic.
${modeGuidance}

## Your Tools
- web_search: Search the web using Google. Pass count: 20 for more results.
- web_fetch: Fetch a web page. For GitHub repo URLs (github.com/owner/repo), returns structured JSON with stars, language, license, description, topics, and last commit date. For other URLs, returns raw HTML.

## Phase 1 Discovery Workflow

IMPORTANT: Execute ALL 6 search strategies simultaneously in your first response. Call all 6 web_search tools at once — do not wait for results before starting the next search.

1. **High-star repos**: Search "site:github.com {topic} stars" with count 20
2. **Awesome lists**: Search "site:github.com awesome-{topic}" with count 20
3. **Editorial roundups**: Search "best open source {topic} 2025 2026" with count 20
${mode === "SCOUT" ? '4. **Competitive landscape**: Search "{topic} open source alternatives 2025 2026" with count 20' : `4. **Architecture patterns**: Search "{topic} system design architecture github" with count 20`}
5. **Direct discovery**: Search "site:github.com {topic}" with count 20
6. **GitHub topics**: Search "github.com/topics/{topic} repositories" with count 20

## Verification Requirements

- After discovery, use web_fetch to verify the **top 8-12** most promising repos (Tier 1 candidates). Batch all web_fetch calls in a single response for parallel execution.
- web_fetch on a GitHub repo URL returns structured JSON metadata — no need to parse HTML yourself.
- For remaining repos, use metadata from search snippets and mark verification level as "inferred".
- Do NOT fabricate or guess star counts, dates, or other data.
- Do NOT search Reddit — community analysis is handled by the deep dive phase.

## Quality Tier Assignment
- Tier 1 (★★★): >1000 stars, active within 6 months, strong community signal
- Tier 2 (★★): 100-1000 stars OR active with good documentation
- Tier 3 (★): <100 stars but relevant, or stale but historically important

## Output Format

After all searches and verifications, return a JSON object with this exact structure:
{
  "topic": "extracted topic from user query",
  "observations": ["observation 1 about the landscape", "observation 2", "observation 3"],
  "repos": [
    {
      "repo_url": "https://github.com/owner/repo",
      "repo_name": "owner/repo",
      "stars": 12500,
      "last_commit": "2026-02-15",
      "primary_language": "TypeScript",
      "license": "MIT",
      "quality_tier": 1,
      "reddit_signal": "no_data",
      "summary": "One-line description of what this repo does and why it matters",
      "source_strategies": ["high_star", "awesome_list"],
      "verification": {
        "existence": { "status": "live", "checked_at": "2026-02-25T00:00:00Z" },
        "stars": { "value": 12500, "level": "verified", "source": "github" },
        "last_commit": { "value": "2026-02-15", "level": "verified" },
        "language": { "value": "TypeScript", "level": "verified" },
        "license": { "value": "MIT", "level": "verified" },
        "freshness": { "status": "active", "level": "verified" },
        "community": { "signal": "no_data", "level": "inferred" }
      }
    }
  ],
  "curated_lists": [
    { "name": "awesome-topic", "url": "https://github.com/...", "description": "..." }
  ],
  "industry_tools": [
    { "name": "Tool Name", "description": "Non-GitHub tool relevant to topic", "url": "..." }
  ]
}

IMPORTANT:
- Return ONLY the JSON object, no markdown code fences, no extra text
- Aim for 15-25 repos total across all strategies
- Deduplicate by repository URL
- Be efficient: batch web_fetch calls, do not verify every single repo`;
}
```

**Step 2: Update the call site to pass `isVagueQuery`**

In the GET handler (~line 283), change `buildSystemPrompt(mode)` to compute vagueness from `detectMode`:

```typescript
const modeResult = detectMode(query);
const isVagueQuery = modeResult.confidence === 0;
```

And pass it:
```typescript
systemPrompt: buildSystemPrompt(mode, isVagueQuery),
```

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add app/api/scout/route.ts
git commit -m "feat: 6-strategy parallel prompt with verify 8-12 and vague query handling"
```

---

### Task 4: Adaptive maxToolRounds based on query confidence

**Files:**
- Modify: `app/api/scout/route.ts` (GET handler)

**Step 1: Change the maxToolRounds passed to callLLMWithTools**

In the GET handler, replace the hardcoded `maxToolRounds: 8` with:

```typescript
maxToolRounds: isVagueQuery ? 10 : 8,
```

The `isVagueQuery` variable was already computed in Task 3.

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add app/api/scout/route.ts
git commit -m "feat: adaptive maxToolRounds — 10 for vague queries, 8 for specific"
```

---

### Task 5: Update SSE strategy detection for new strategies

**Files:**
- Modify: `app/api/scout/route.ts` (the `onToolCall` handler)

**Step 1: Add strategy inference for direct_discovery and github_topics**

In the `onToolCall` handler (~line 312-329), update the strategy inference block:

```typescript
if (toolName === "web_search") {
  const searchQuery = (args.query as string) || "";
  // Infer strategy from search query patterns
  let strategy = "general";
  if (searchQuery.includes("stars") || searchQuery.includes("popular")) strategy = "high_star";
  else if (searchQuery.includes("awesome")) strategy = "awesome_list";
  else if (searchQuery.includes("best") || searchQuery.includes("roundup")) strategy = "editorial";
  else if (searchQuery.includes("architecture") || searchQuery.includes("design")) strategy = "architecture";
  else if (searchQuery.includes("alternative")) strategy = "competitive";
  else if (searchQuery.includes("github.com/topics")) strategy = "github_topics";
  else if (searchQuery.includes("site:github.com") && !searchQuery.includes("awesome") && !searchQuery.includes("stars")) strategy = "direct_discovery";

  if (!strategiesSeen.has(strategy)) {
    strategiesSeen.add(strategy);
    send("search_progress", {
      strategy,
      status: "running",
      repos_found: 0,
    });
  }
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add app/api/scout/route.ts
git commit -m "feat: SSE strategy detection for direct_discovery and github_topics"
```

---

### Task 6: Run full test suite and verify everything passes

**Files:**
- All test files

**Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests PASS (77 existing + new tests from Tasks 1-2)

**Step 2: Fix any broken tests**

If the existing `detectMode` test "returns null mode for ambiguous queries" (`detectMode("python library")`) now returns SCOUT because "library" is a new trigger, update the test:

```typescript
it("returns null mode for very short ambiguous queries", () => {
  const result = detectMode("data stuff");
  expect(result.mode).toBeNull();
  expect(result.confidence).toBe(0);
});
```

**Step 3: Run tests again to confirm all pass**

Run: `npx vitest run`
Expected: ALL PASS

**Step 4: Commit any test fixes**

```bash
git add -A
git commit -m "test: fix existing tests for expanded mode detection triggers"
```

---

### Task 7: Update MEMORY.md and PROJECT-TRACKER.md

**Files:**
- Modify: `docs/plans/2026-02-26-supabase-persistence-tracker.md`

**Step 1: Add Phase 7 to project tracker**

Append Phase 7 section to tracker:

```markdown
## Phase 7: Search Discovery Improvements (Wide Net)

| # | Task | Status |
|---|------|--------|
| 1 | Expand mode detection triggers + vague query handling | COMPLETE |
| 2 | Bump Serper default from 10 → 20 results | COMPLETE |
| 3 | 6-strategy parallel prompt + verify 8-12 repos | COMPLETE |
| 4 | Adaptive maxToolRounds (10 vague / 8 specific) | COMPLETE |
| 5 | SSE strategy detection for new strategies | COMPLETE |
| 6 | Full test suite verification | COMPLETE |
| 7 | Update tracker and memory | COMPLETE |

**Summary:** 6 search strategies (was 4), 20 results per query (was 10), explicit parallel execution instruction, vague query "broad discovery" mode, verify 8-12 repos (was 5-8), adaptive tool rounds.
```

**Step 2: Commit**

```bash
git add docs/plans/2026-02-26-supabase-persistence-tracker.md
git commit -m "docs: add Phase 7 search discovery improvements to project tracker"
```
