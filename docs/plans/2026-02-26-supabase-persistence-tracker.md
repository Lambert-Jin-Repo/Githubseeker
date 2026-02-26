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

## Tests

46/46 passing (8 test files), TypeScript compiles clean
