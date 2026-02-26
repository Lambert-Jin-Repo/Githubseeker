# Supabase Persistence Wiring — Design Document

**Date:** 2026-02-26
**Status:** Approved
**Scope:** Wire all API routes to Supabase; load saved results; place FeedbackWidget & ExportButton in UI

## Context

All 23 implementation tasks for GitHub Scout are complete. The app works end-to-end but uses in-memory storage. This design covers wiring Supabase persistence into all API routes and adding the ability to revisit completed searches.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| RLS approach | Service role bypass | Server-side only routes; anonymous auth (cookie = user_id); avoids per-request `SET app.user_id` complexity |
| Results loading | Load from Supabase | Enables full history support; users can revisit `/scout/[id]` after stream ends |
| Results endpoint | New `GET /api/scout/[id]/results` | Clean separation from SSE stream route |

## Architecture

### 1. `lib/supabase.ts` — Simplify server client

- Remove unused `userId` param from `createServerClient()`
- Use `SUPABASE_SECRET_KEY` (service role) for all server-side operations
- Add `getSessionUserId(request: NextRequest): string` helper — reads cookie, returns session ID
- Service role bypasses RLS; we still store `user_id` on rows and filter by it in WHERE clauses

### 2. Phase 1: `app/api/scout/route.ts`

**POST handler:**
- Extract session cookie → `user_id`
- Insert into `searches` table: `{ id, user_id, query, mode }`
- Keep in-memory map for SSE GET handoff

**GET handler (after LLM completes):**
- Batch-insert deduped repos into `search_results` (search_id, repo_url, repo_name, stars, etc.)
- Update `searches`: set `phase1_complete = true`, `observations`, `topic_extracted`
- All DB writes after stream completes (repos arrive as one JSON blob, not incrementally)

### 3. Phase 2: `app/api/scout/[id]/deep-dive/route.ts`

- After each repo deep dive: update `search_results.deep_dive` JSONB (match by `search_id` + `repo_url`)
- After all repos + summary: set `searches.phase2_complete = true`

### 4. Feedback: `app/api/feedback/route.ts`

- Insert into `feedback` table: `{ search_id, repo_url, signal, comment }`
- Keep existing validation unchanged

### 5. History: `app/api/history/route.ts`

- **GET**: Query `searches` table by `user_id` from cookie, with count of `search_results` per search
- **POST**: Remove — `POST /api/scout` writes directly to `searches`
- Delete in-memory `historyStore`

### 6. New: `GET /api/scout/[id]/results/route.ts`

- Query `searches` + `search_results` for given search ID
- Return JSON: `{ search, results, hasDeepDive }`
- Client uses this to load saved state

### 7. Client: `ScoutResultsClient.tsx`

- On mount, call `GET /api/scout/[id]/results`
- If search exists and `phase1_complete`, hydrate Zustand store from DB (skip SSE)
- If not found / not complete, fall back to SSE stream

### 8. FeedbackWidget placement

- **RepoRow** expanded section: after "Found via" strategies
- **DeepDiveCard**: in card header, next to repo meta
- Pass `searchId` from parent context

### 9. ExportButton placement

- In `ScoutResultsClient.tsx`, visible once `phase1Complete` is true
- Pass `repos`, `deepDiveResults`, `query` from Zustand store

## Files Changed

| File | Change |
|---|---|
| `lib/supabase.ts` | Simplify `createServerClient`, add `getSessionUserId` |
| `app/api/scout/route.ts` | Add Supabase inserts in POST + GET |
| `app/api/scout/[id]/deep-dive/route.ts` | Add `search_results.deep_dive` upserts |
| `app/api/feedback/route.ts` | Add `feedback` table insert |
| `app/api/history/route.ts` | Replace in-memory with Supabase queries |
| `app/api/scout/[id]/results/route.ts` | New endpoint for loading saved results |
| `app/scout/[id]/ScoutResultsClient.tsx` | Add saved-results loading on mount |
| `components/results/RepoRow.tsx` | Import + render FeedbackWidget |
| `components/deep-dive/DeepDiveCard.tsx` | Import + render FeedbackWidget |
| `app/scout/[id]/ScoutResultsClient.tsx` | Import + render ExportButton |
