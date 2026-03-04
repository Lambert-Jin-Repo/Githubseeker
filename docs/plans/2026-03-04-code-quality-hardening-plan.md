# Phase 10: Code Quality Hardening

**Date:** 2026-03-04
**Trigger:** Full code review across 5 dimensions (API routes, core libs, hooks/stores, tests, external API patterns)
**Goal:** Fix all critical and high-priority major issues. Improve modular design, reliability, and security without changing features.

---

## Group A: Security & Auth Fixes (Critical — 4 tasks)

### A1. Fix legacy auth on V1 deep-dive + dashboard routes
**Files:** `app/api/scout/[id]/deep-dive/route.ts`, `app/api/dashboard/route.ts`
**Issue:** Both use old `getSessionUserId(request)` instead of `getSessionUserIdFromAuth(request, authClient)`. OAuth users get 404 / empty dashboard.
**Fix:** Import `createAuthServerClient` + `getSessionUserIdFromAuth` from `@/lib/supabase`, replace the `getSessionUserId` call. Match the pattern in `deep-dive-v2/route.ts:29-30`.

### A2. Add auth + input limits to feedback route
**File:** `app/api/feedback/route.ts`
**Fix:**
- Add auth check: resolve userId via `getSessionUserIdFromAuth`, verify the `search_id` belongs to the user (query `searches` table)
- Validate `search_id` is UUID format: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`
- Validate `repo_url` starts with `https://github.com/`
- Cap `comment` at 2000 chars
- Add rate limiting (reuse `checkAnonymousRateLimit` for anonymous users)

### A3. Make rate limiting atomic
**File:** `lib/rate-limit.ts`
**Issue:** Read-then-write race condition (TOCTOU). Two concurrent requests can both pass.
**Fix:** Create a Supabase RPC function:
```sql
CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
  p_ip text, p_limit int, p_window_hours int
) RETURNS TABLE(allowed boolean, remaining int) AS $$
DECLARE
  v_count int;
BEGIN
  -- Upsert with atomic increment
  INSERT INTO rate_limits (ip_address, search_count, window_start)
  VALUES (p_ip, 1, now())
  ON CONFLICT (ip_address) DO UPDATE
  SET search_count = CASE
    WHEN rate_limits.window_start < now() - (p_window_hours || ' hours')::interval
    THEN 1
    ELSE rate_limits.search_count + 1
  END,
  window_start = CASE
    WHEN rate_limits.window_start < now() - (p_window_hours || ' hours')::interval
    THEN now()
    ELSE rate_limits.window_start
  END
  RETURNING search_count INTO v_count;

  IF v_count > p_limit THEN
    RETURN QUERY SELECT false, 0;
  ELSE
    RETURN QUERY SELECT true, p_limit - v_count;
  END IF;
END;
$$ LANGUAGE plpgsql;
```
Then replace the multi-step logic in `checkAnonymousRateLimit` with a single RPC call.

### A4. Add auth check + input caps to SSE GET and deep dive routes
**Files:** `app/api/scout/route.ts` (GET handler), `app/api/scout/[id]/deep-dive/route.ts`, `app/api/scout/[id]/deep-dive-v2/route.ts`
**Fix:**
- SSE GET: verify search's `user_id` matches the requesting user before streaming
- Deep dive routes: cap `repo_urls` array at 10 items, return 400 if exceeded

---

## Group B: API Reliability (Critical + Major — 5 tasks)

### B1. Add timeout + retry to LLM client
**File:** `lib/llm.ts`
**Fix:** Add `timeout: 60000` and `maxRetries: 2` to the OpenAI client constructor. Wrap `JSON.parse(tc.function.arguments)` on line 130 in try/catch. Add null-check on `response.choices[0]` before accessing `.message`.

### B2. Add timeout to Serper fetch
**File:** `lib/web-search.ts`
**Fix:** Add `signal: AbortSignal.timeout(10000)` to the Serper fetch call (line 13). Include response body in error message for diagnostics.

### B3. Add abort signal on SSE client disconnect
**File:** `app/api/scout/route.ts`
**Fix:** Replace unused `controllerRef` with an `AbortController`. In `cancel()`, call `abort()`. Pass the signal through `callLLMWithTools` (add optional `signal` param to `LLMCallOptions`). Check abort state in the tool execution loop.

### B4. Fall back to Supabase when `pendingSearches` map misses
**File:** `app/api/scout/route.ts` (GET handler, lines 277-280)
**Fix:** When `pendingSearches.get(searchId)` returns undefined, query Supabase for the search's `query` and `mode` before returning 404. This makes the endpoint serverless-compatible.

### B5. Add env var validation
**Files:** `lib/llm.ts`, `lib/web-search.ts`, `lib/supabase.ts`
**Fix:** Replace non-null assertions (`!`) with explicit validation that throws a clear error message. Use lazy init or a shared `lib/env.ts` module:
```typescript
export function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}
```

---

## Group C: Client-Side Fixes (Critical + Major — 5 tasks)

### C1. Fix EventSource close on reconnect exhaustion
**Files:** `hooks/useScoutStream.ts:172`, `hooks/useGlobalSearchStream.ts:121`
**Fix:** Add `es.close()` before `setError(...)` in the `else` branch when reconnect attempts are exhausted.

### C2. Fix full store subscription in useScoutStream
**File:** `hooks/useScoutStream.ts:15`
**Fix:** Replace `const store = useScoutStore()` with `useScoutStore.getState()` for imperative actions inside the effect callback, matching the pattern in `useGlobalSearchStream.ts:41-42`.

### C3. Add deduplication to `addRepo` in scout-store
**File:** `stores/scout-store.ts:83`
**Fix:** Change `addRepo: (repo) => set((s) => ({ repos: [...s.repos, repo] }))` to filter out duplicates by `repo_url`:
```typescript
addRepo: (repo) => set((s) => ({
  repos: s.repos.some((r) => r.repo_url === repo.repo_url)
    ? s.repos
    : [...s.repos, repo],
})),
```
Also add same dedup to V1 `addDeepDiveResult` (line 127).

### C4. Add AbortController cleanup on unmount for deep dive hooks
**Files:** `hooks/useDeepDiveStream.ts`, `hooks/useDeepDiveStreamV2.ts`
**Fix:** Add a `useEffect` cleanup that calls `abortControllerRef.current?.abort()`.

### C5. Fix stale closure over `completedCount`
**Files:** `hooks/useDeepDiveStream.ts:148,190`, `hooks/useDeepDiveStreamV2.ts:181,223`
**Fix:** Use the functional updater pattern consistently: `setProgress((prev) => ({ ...prev, completed: prev.completed + 1 }))`. Remove the mutable local `completedCount` variable.

---

## Group D: Modular Design Refactors (Major — 5 tasks)

### D1. Extract SSE utilities to shared module
**New file:** `lib/sse.ts`
**Fix:** Extract `sseEncode()`, `createSSEStream()` factory (with `send`, `safeClose`, `closed` flag, standard headers). Update `app/api/scout/route.ts`, `deep-dive/route.ts`, `deep-dive-v2/route.ts` to import from `lib/sse.ts`.

### D2. Extract `extractJSON` to shared module, break V1 coupling
**New file:** `lib/text-utils.ts`
**Fix:** Move `extractJSON` from `lib/deep-dive-analyzer.ts` to `lib/text-utils.ts`. Update imports in both `deep-dive-analyzer.ts` and `deep-dive-analyzer-v2.ts`.

### D3. Consolidate `SESSION_COOKIE_NAME`
**Files:** `lib/session.ts`, `lib/supabase.ts`
**Fix:** Export `SESSION_COOKIE_NAME` from `lib/session.ts` only. Import it in `lib/supabase.ts` instead of redefining.

### D4. Extract `persistDeepDive` to shared module
**New file:** `lib/persistence.ts`
**Fix:** Move the `persistDeepDiveV2` function (and the identical V1 version) into a single shared function with a `logPrefix` parameter. Update both analyzers to import from it.

### D5. Extract duplicated SSE event parsing from hooks
**New file:** `lib/sse-parser.ts`
**Fix:** Extract the `parseSSEEvents` helper (duplicated in `useDeepDiveStream.ts:24-50` and `useDeepDiveStreamV2.ts:34-60`) into a shared module. Export and import in both hooks.

---

## Group E: Test Coverage (Major — 6 tasks)

### E1. Add V1 parser unit tests
**New file:** `lib/__tests__/deep-dive-analyzer.test.ts`
**Fix:** Test `extractJSON`, `parseSection`, `parseAIPatterns`, `parseDeepDiveResult`, `parseSummary` with valid input, malformed input, empty input, and partial input.

### E2. Add malformed-input tests for V2 parsers
**File:** `lib/__tests__/deep-dive-analyzer-v2.test.ts`
**Fix:** Add test cases where mocked LLM returns: (a) empty string, (b) partial JSON with missing fields, (c) wrong types for fields (number where string expected), (d) `<think>` tags wrapping JSON.

### E3. Add API route handler tests (scout POST)
**New file:** `app/api/scout/__tests__/route.test.ts`
**Fix:** Test input validation (short query, long query, missing query), cache hit path, rate limit path, happy path response shape. Mock `callLLMWithTools`, Supabase, and `checkAnonymousRateLimit`.

### E4. Add feedback route tests
**New file:** `app/api/feedback/__tests__/route.test.ts`
**Fix:** Test missing fields (400), invalid UUID (400), invalid signal value (400), happy path (200), Supabase error (500).

### E5. Test `webSearch` error paths
**File:** `lib/__tests__/web-search.test.ts`
**Fix:** Add tests for non-OK response (throw), network failure (throw), malformed JSON response.

### E6. Test `getOrCreateSessionId`
**File:** `lib/__tests__/session.test.ts`
**Fix:** Test cookie read (existing valid session), cookie write (no existing cookie), invalid cookie (regenerate).

---

## Task Summary

| Group | Tasks | Priority | Effort |
|-------|-------|----------|--------|
| A: Security & Auth | 4 | Critical | Medium |
| B: API Reliability | 5 | Critical/Major | Medium |
| C: Client-Side Fixes | 5 | Critical/Major | Low-Medium |
| D: Modular Design | 5 | Major | Low |
| E: Test Coverage | 6 | Major | Medium |
| **Total** | **25** | | |

## Implementation Order

Execute groups in order: **A → B → C → D → E**. Within each group, tasks are independent and can be parallelized.

## Verification

After each group:
1. `npm run test` — all tests pass
2. `npx tsc --noEmit` — no type errors
3. Dev test: search a topic on localhost:3333, verify Phase 1 + deep dive works
