# Agent Ecosystem Discovery — Design Document

**Date:** 2026-02-26
**Status:** Approved

## Problem

Skills in GitHub Scout deep dive are purely LLM-generated from static repo data (README, deps, tree). The AI Patterns section detects agent files by name, but never reads their contents. Skills Required badges are generic ("React", "TypeScript") rather than grounded in what real developers actually configure for AI-assisted workflows.

Users want to know: does this repo have `.cursorrules`? What's in its `mcp.json`? Are there Claude skills configured? What agent tools are trending in this stack?

## Solution

Add a **batch web search step** before the 4-group LLM calls in `analyzeRepoV2()`. Search GitHub for real agent ecosystem files across all repos in a single Serper query, fetch discovered file contents, and inject results as context into Group C's prompt. Group C stays pure completion (`maxToolRounds: 0`) — no per-repo web calls.

## Architecture

```
analyzeRepoV2() called for N repos in parallel
    ↓
fetchRepoData() per repo (existing, unchanged)
    ↓
NEW: batchSearchAgentEcosystem(repos[])
    │
    ├─ 1 Serper query: site:github.com (.cursorrules OR mcp.json OR
    │  skills.yaml OR .claude) "owner1/repo1" OR "owner2/repo2" ...
    │
    ├─ 1 Serper query: "{tech_stack} agent skills tools trending 2026"
    │
    └─ Parallel fetchWebPage() for each discovered file URL
    ↓
Map<repoUrl, AgentEcosystemRaw> distributed to Group C prompts
    ↓
4 parallel LLM groups per repo (Groups A/B/D unchanged)
    Group C: enhanced prompt + injected ecosystem data
    (still maxToolRounds: 0)
    ↓
Parse, merge, persist (existing flow)
```

### Key Decision: Batch Search + Context Injection (not per-repo agentic)

**Why not make Group C agentic (maxToolRounds: 3)?**
- Per-repo searches cost 2-4 Serper credits × 8-12 repos = 16-48 credits per session
- Batch approach: 2 credits total regardless of repo count
- Latency: +3s batch vs +15-20s per repo agentic

## New Type: AgentEcosystemDiscovery

```typescript
interface AgentEcosystemDiscovery {
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

Added to `DeepDiveResultV2` as `agent_ecosystem: AgentEcosystemDiscovery`.

## Enhanced Group C Prompt

The system prompt gets additional context:

```
AGENT ECOSYSTEM DATA (from web search — these are REAL files found on GitHub):
{injected batch search results per repo}

Use this real data to:
1. Populate discovered_files with actual files found (not guesses)
2. Map ecosystem support (Cursor, Claude, MCP, etc.) based on what exists
3. Cross-reference trending_tools with the repo's tech stack
4. Enhance skills_required with specific skills derived from actual config files
```

Group C's JSON output schema adds the `agent_ecosystem` key alongside existing `ai_patterns`, `skills_required`, and `mode_specific`.

## New Function: batchSearchAgentEcosystem()

**Location:** `lib/deep-dive-analyzer-v2.ts`

```typescript
async function batchSearchAgentEcosystem(
  repos: Array<{ owner: string; repo: string; repoUrl: string }>
): Promise<Map<string, AgentEcosystemRaw>>
```

1. Build a single Serper query combining all repo identifiers
2. Build a trending tools query based on common tech stack across repos
3. Fire both queries in parallel via `webSearch()`
4. For each discovered file URL matching a known repo, fetch contents via `fetchWebPage()`
5. Return a Map keyed by repoUrl

**Edge cases:**
- Serper query too long (>2048 chars): split into batches of 4-5 repos
- No results found: return empty map (Group C falls back to static analysis)
- fetchWebPage timeout: skip that file, log warning

## New UI Component: AgentEcosystemSection

**Location:** `components/deep-dive/AgentEcosystemSection.tsx`

Three sub-sections:

### Discovered Files
Card list showing real agent config files found in the repo.
- File type icon + path + external link
- 1-2 line summary of contents
- Links to actual GitHub blob URLs

### Platform Support
Badge row showing which agent ecosystems have configurations:
- Cursor (teal if .cursorrules found, muted if not)
- Claude (teal if .claude/ or skills found)
- MCP (teal if mcp.json found)
- Others listed if detected

### Trending in This Stack
Compact list of trending tools relevant to the repo's tech stack:
- Tool name + relevance description + optional link

**Renders null if all discovery fields are empty** (same pattern as SkillsSection).

## Cost Analysis

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Serper credits per search | ~18-20 | ~20-22 | +2 |
| Sessions per 2,500 free credits | ~125 | ~113 | -12 |
| Group C latency per repo | ~12s | ~12s | +0s |
| Batch search step (one-time) | 0s | ~3s | +3s |
| Total deep dive time | ~29s | ~32s | +3s |

## Files to Modify

1. `lib/types.ts` — Add `AgentEcosystemDiscovery` type, add to `DeepDiveResultV2`
2. `lib/deep-dive-analyzer-v2.ts` — Add `batchSearchAgentEcosystem()`, enhance Group C prompt, update parser
3. `lib/web-search.ts` — No changes needed (existing `webSearch` + `fetchWebPage` sufficient)
4. `components/deep-dive/AgentEcosystemSection.tsx` — New component
5. `components/deep-dive-page/RepoAnalysisCard.tsx` — Add AgentEcosystemSection to card layout
6. `stores/scout-store.ts` — No changes (DeepDiveResultV2 type update flows through)
7. Tests — Update existing deep dive tests, add new tests for batch search and component

## Out of Scope

- Caching discovered agent files (future: store in Supabase for cross-search intelligence)
- User-facing "Discover More" button for on-demand deeper searches
- skill_versions table integration (reserved for future skill iteration system)
- Summary-level ecosystem comparison across repos (future enhancement)
