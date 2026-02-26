# Supabase Persistence — Project Tracker

**Started:** 2026-02-26
**Completed:** 2026-02-26
**Design:** `docs/plans/2026-02-26-supabase-persistence-design.md`

## Task Status

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

## Post-Review Fixes

- Added user_id authorization to results and deep-dive endpoints
- Added empty array guard in history endpoint
- Added store.reset() before hydrating saved results (React strict mode safety)
- Added type guard for observations array
- Fixed misleading "non-blocking" comment

## Commits (12 total)

1. `37a142c` refactor: simplify supabase client to service role + add getSessionUserId helper
2. `e7252cf` chore: remove unused beforeEach import from supabase test
3. `d65bf11` feat: persist Phase 1 search and results to Supabase
4. `5e79809` fix: correct comment and add type guard for observations array
5. `384f192` feat: persist deep dive results and phase2 completion to Supabase
6. `7b42f99` feat: persist feedback to Supabase feedback table
7. `201d5f4` feat: wire history to Supabase, remove in-memory store
8. `bf8da7c` feat: add GET /api/scout/[id]/results endpoint for loading saved searches
9. `4ceef57` feat: load saved results from Supabase before falling back to SSE
10. `96cbf13` feat: wire FeedbackWidget into RepoRow and DeepDiveCard
11. `9f259a4` feat: wire ExportButton into results page
12. `baadbab` fix: add authorization checks and robustness improvements

## Tests

46/46 passing (8 test files, 3 new tests for supabase helper)
