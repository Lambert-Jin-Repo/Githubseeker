# GitHub Scout — Master Project Tracker

**Started:** 2026-02-26

---

## Phase 2: Supabase Persistence (COMPLETE)

**Completed:** 2026-02-26
**Design:** `docs/plans/2026-02-26-supabase-persistence-design.md`

| # | Task | Status | Files |
|---|---|---|---|
| 1 | Simplify `lib/supabase.ts` — service role client + session helper | `done` | `lib/supabase.ts` |
| 2 | Wire Phase 1 POST — save search to `searches` table | `done` | `app/api/scout/route.ts` |
| 3 | Wire Phase 1 GET — save repos + observations on completion | `done` | `app/api/scout/route.ts` |
| 4 | Wire Phase 2 — upsert `deep_dive` JSONB per repo, set `phase2_complete` | `done` | `app/api/scout/[id]/deep-dive/route.ts` |
| 5 | Wire feedback — insert into `feedback` table | `done` | `app/api/feedback/route.ts` |
| 6 | Wire history — replace in-memory with Supabase queries | `done` | `app/api/history/route.ts` |
| 7 | New endpoint — `GET /api/scout/[id]/results` for loading saved results | `done` | `app/api/scout/[id]/results/route.ts` |
| 8 | Client — load saved results on mount before SSE fallback | `done` | `hooks/useScoutStream.ts` |
| 9 | Place FeedbackWidget in RepoRow and DeepDiveCard | `done` | `components/results/RepoRow.tsx`, `components/deep-dive/DeepDiveCard.tsx` |
| 10 | Place ExportButton in results page | `done` | `app/scout/[id]/ScoutResultsClient.tsx` |

**Commits:** 12 (`37a142c` through `baadbab`)

---

## Phase 3: Polish & Robustness (COMPLETE)

**Completed:** 2026-02-26
**Migration:** `supabase/migration_phase3.sql`

| # | Task | Status | Files |
|---|---|---|---|
| 1 | Secure cookie flag — add `; Secure` on HTTPS | `done` | `lib/session.ts` |
| 2 | Singleton Supabase client — cache server client | `done` | `lib/supabase.ts` |
| 3 | Deep dive update verification — `.select("id")` + warn on 0 rows | `done` | `app/api/scout/[id]/deep-dive/route.ts` |
| 4 | Supabase migration — feedback unique constraint, count RPC, cache index | `done` | `supabase/migration_phase3.sql` (applied via MCP) |
| 5 | Feedback deduplication — upsert + client-side ref guard | `done` | `app/api/feedback/route.ts`, `components/feedback/FeedbackWidget.tsx` |
| 6 | History endpoint optimization — use `count_results_by_search` RPC | `done` | `app/api/history/route.ts` |
| 7 | Serper error surfacing — `onToolError` callback, `search_error` SSE event, failed badge | `done` | `lib/llm.ts`, `app/api/scout/route.ts`, `hooks/useScoutStream.ts`, `components/results/StreamingProgress.tsx` |
| 8 | MiniMax error recovery + retry — partial results, recoverable flag, retry button | `done` | `app/api/scout/route.ts`, `app/api/scout/[id]/deep-dive/route.ts`, `hooks/useScoutStream.ts`, `app/scout/[id]/ScoutResultsClient.tsx` |
| 9 | Loading state improvements — `isLoadingSaved`, skeleton, saved-results UX | `done` | `hooks/useScoutStream.ts`, `app/scout/[id]/ScoutResultsClient.tsx` |
| 10 | Search result caching + refresh — 24h cache, `force_refresh`, cached label | `done` | `app/api/scout/route.ts`, `app/page.tsx`, `app/scout/[id]/ScoutResultsClient.tsx` |
| 11 | SafeClose guard — fix "Controller is already closed" crashes | `done` | `app/api/scout/route.ts`, `app/api/scout/[id]/deep-dive/route.ts` |
| 12 | Orbital radar loading screen — animated SVG radar with cinematic reveal | `done` | `components/results/SearchLoadingScreen.tsx`, `app/globals.css`, `app/scout/[id]/ScoutResultsClient.tsx` |

**Commits:** `2e7a90e` feat: Phase 3 polish — error recovery, caching, radar loading screen

---

## Phase 6: Search Performance Optimization (COMPLETE)

**Completed:** 2026-02-26

| # | Task | Status | Files |
|---|---|---|---|
| 1 | Parallelize tool calls — `Promise.allSettled` in LLM loop | `done` | `lib/llm.ts` |
| 2 | GitHub metadata extraction — regex-based `fetchGitHubMetadata()` (~300B vs 50KB) | `done` | `lib/web-search.ts` |
| 3 | Route `web_fetch` for GitHub repo URLs through metadata extractor | `done` | `lib/llm.ts` |
| 4 | Streamline system prompt — 4 strategies (was 6), verify top 5-8 (was all), remove Reddit | `done` | `app/api/scout/route.ts` |
| 5 | Lower maxToolRounds 12 → 8 | `done` | `app/api/scout/route.ts` |
| 6 | Tests — 10 llm.test.ts + 6 web-search.test.ts | `done` | `lib/__tests__/llm.test.ts`, `lib/__tests__/web-search.test.ts` |

**Commits:** `3daeda7` perf: parallelize tool calls, add GitHub metadata extraction, streamline prompt

**Expected impact:** Phase 1 search 25-50s (was 60-120s), ~5-7 tool rounds (was ~12), ~2KB context per repo (was 50KB HTML)

---

## Phase 7: Search Discovery — Wide Net (COMPLETE)

**Completed:** 2026-02-26
**Design:** `docs/plans/2026-02-26-search-wide-net-design.md`
**Plan:** `docs/plans/2026-02-26-search-wide-net-plan.md`

| # | Task | Status | Files |
|---|---|---|---|
| 1 | Expand mode detection triggers + vague query handling | `done` | `lib/mode-detection.ts`, `lib/__tests__/mode-detection.test.ts` |
| 2 | Bump Serper default from 10 → 20 results | `done` | `lib/web-search.ts`, `lib/__tests__/web-search.test.ts` |
| 3 | 6-strategy parallel prompt + verify 8-12 repos | `done` | `app/api/scout/route.ts` |
| 4 | Adaptive maxToolRounds (10 vague / 8 specific) | `done` | `app/api/scout/route.ts` |
| 5 | SSE strategy detection for direct_discovery + github_topics | `done` | `app/api/scout/route.ts` |
| 6 | Full test suite verification | `done` | 84/84 tests passing |
| 7 | Update tracker and memory | `done` | `PROJECT-TRACKER.md`, `MEMORY.md` |

**Commits:** `a8aeb39`, `3f7e194`, `c4f3844`

**Summary:** 6 search strategies (was 4), 20 results per query (was 10), explicit parallel execution instruction in prompt, vague query "broad discovery" mode, verify 8-12 repos (was 5-8), adaptive tool rounds (10 for vague / 8 for specific), 17 new trigger words for mode detection.

**Expected impact:** ~120 raw results per search (was ~40), popular repos much less likely to be missed, vague queries get broad exploration instead of competitive-landscape default.

---

## Bug Fix: SSE Infinite Reconnection Loop (2026-03-05)

**Root cause:** When MiniMax API returns 429 (rate limit), the SSE error event handler closes the EventSource, but the native `onerror` handler fires immediately after. Since `onopen` resets `reconnectAttemptsRef` to 0 on every successful HTTP 200 connection, the retry counter never reaches 3, causing an infinite reconnection loop with a new toast notification on each cycle.

| # | Fix | Status | Files |
|---|---|---|---|
| 1 | Add `serverErrorReceivedRef` flag to prevent onerror reconnection after explicit server error | `done` | `hooks/useGlobalSearchStream.ts`, `hooks/useScoutStream.ts` |
| 2 | Close EventSource on non-recoverable errors (was missing `es.close()`) | `done` | `hooks/useGlobalSearchStream.ts`, `hooks/useScoutStream.ts` |

---

## Tests

256/256 passing (21 test files), TypeScript compiles clean

*Updated 2026-03-05 after SSE reconnection bug fix*
