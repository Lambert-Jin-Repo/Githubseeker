# Wide Net Search Improvements — Design Doc

**Date:** 2026-02-26
**Phase:** 7 — Search Discovery Improvements
**Goal:** Fix gaps causing popular repos to be missed in search results

## Problem

Popular, well-known repositories (e.g., "superpower", "ui ux pro max") don't appear when searching broad/vague queries like "Frontend agent skills." Root causes:

1. Only 4 hardcoded search strategies — missing direct discovery and GitHub topics
2. Only 10 results per Serper query — popular repos fall outside top 10
3. Prompt doesn't instruct LLM to fire all searches in parallel (wastes tool rounds)
4. Mode detection fails on vague queries (defaults to SCOUT competitive landscape)
5. `maxToolRounds: 8` is tight for broad queries needing more exploration
6. Only top 5-8 repos get verified — rest rely on stale Google snippets

## Design

### 1. Search Strategies: 4 → 6

Existing 4 strategies remain. Add 2 new ones:

| # | Strategy | Query Pattern | Purpose |
|---|----------|--------------|---------|
| 1 | High-star repos | `site:github.com {topic} stars` | Existing |
| 2 | Awesome lists | `site:github.com awesome-{topic}` | Existing |
| 3 | Editorial roundups | `best open source {topic} 2025 2026` | Existing |
| 4 | Mode-specific | varies | Existing |
| 5 | **Direct discovery** | `site:github.com {topic}` | Broadest net, no keyword bias |
| 6 | **GitHub topics** | `github.com/topics/{topic} repositories` | Tagged repos on GitHub |

### 2. Serper Results Per Query: 10 → 20

- Update `webSearch()` default from 10 → 20
- Prompt tells LLM to use `count: 20`
- Doubles discovery surface per strategy
- No extra API latency (Serper returns 20 as fast as 10)
- Credit cost: ~18-20 per search (up from ~8-12)

### 3. Parallel Execution via Prompt

The `Promise.allSettled` infrastructure in `lib/llm.ts` already supports parallel tool calls. The fix is in the **prompt**:

> "IMPORTANT: Execute ALL 6 search strategies simultaneously in your first response. Call all 6 web_search tools at once — do not wait for results before starting the next search."

This means:
- Round 1: 6 parallel `web_search` calls (~1s wall-clock)
- Rounds 2-9: Verification `web_fetch` calls + JSON compilation
- Net effect: More tool rounds available for verification

### 4. Verification: Top 5-8 → Top 8-12

More results discovered = more worth verifying. Prompt changes:
- "Verify the top 8-12 most promising repos (Tier 1 candidates)"
- "Batch all web_fetch verification calls in a single response for parallel execution"
- Verification calls already run via `Promise.allSettled`

### 5. Mode Detection: Vague Query Handling

When `detectMode()` returns `null` (no triggers matched):

**Current behavior:** Silent default to SCOUT → "competitive landscape" searches
**New behavior:** Detect low-confidence and use "DISCOVER" prompt variant:
- Same SCOUT mode enum (no type changes)
- Modified prompt: "Explore broadly across the ecosystem" instead of "Focus on competitive landscape"
- Extra trigger words for better coverage:
  - SCOUT: "agent", "framework", "tool", "library", "toolkit", "sdk", "platform"
  - LEARN: "skill", "practice", "master", "training"
  - BUILD: "app", "application", "service", "api", "backend", "frontend"

### 6. Adaptive maxToolRounds

- Vague queries (mode confidence = 0): `maxToolRounds: 10`
- Clear queries (mode confidence > 0): `maxToolRounds: 8`

Passed from GET handler based on `detectMode()` confidence.

### 7. SSE Strategy Detection

Update `onToolCall` in GET handler with new strategy inference patterns:
- Query contains `"github.com/topics"` → `"github_topics"`
- Query is `site:github.com {topic}` (no extra keywords) → `"direct_discovery"`

## Files Changed

| File | Changes |
|------|---------|
| `app/api/scout/route.ts` | 6-strategy prompt, parallel instruction, discover fallback, adaptive maxToolRounds, SSE strategy patterns |
| `lib/web-search.ts` | Default count 10 → 20 |
| `lib/mode-detection.ts` | More trigger words, vague-query detection |
| Tests | Update for new defaults and new trigger words |

## MiniMax Efficiency Impact

- **LLM calls:** Same or fewer (all searches in round 1 = fewer rounds wasted on sequential discovery)
- **Context size:** ~30% larger from 20 results × 6 strategies, but well within M2.5's 128K window
- **Latency:** Discovery phase drops from ~6s (sequential) to ~1s (parallel). Verification unchanged.
- **Serper credits:** ~18-20 per search (up from ~8-12). Offset by 24h cache.

## Success Criteria

- Query "Frontend agent skills" returns 20+ repos including well-known ones
- All 6 search strategies fire in round 1 (visible in SSE events)
- Vague queries get broader exploration instead of competitive-landscape focus
- Existing tests pass; new tests cover new strategies and mode detection
