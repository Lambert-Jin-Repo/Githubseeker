# Supabase Persistence Wiring — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire all API routes to Supabase so searches, results, deep dives, and feedback persist to the database — and users can revisit completed searches.

**Architecture:** Server-side Supabase client using service role key (bypasses RLS). Session cookie (`github_scout_session`) used as `user_id` on rows and in WHERE clauses. New `/api/scout/[id]/results` endpoint for loading saved searches. Client hydrates from DB before falling back to SSE.

**Tech Stack:** Next.js 16 App Router, Supabase JS client (`@supabase/supabase-js`), Zustand, TypeScript

**Design doc:** `docs/plans/2026-02-26-supabase-persistence-design.md`

**Tracker:** `docs/plans/2026-02-26-supabase-persistence-tracker.md`

---

### Task 1: Simplify `lib/supabase.ts` — service role client + session helper

**Files:**
- Modify: `lib/supabase.ts`
- Create: `lib/__tests__/supabase.test.ts`

**Step 1: Write the failing test**

Create `lib/__tests__/supabase.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock env vars before importing
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk-test-key");
vi.stubEnv("SUPABASE_SECRET_KEY", "sk-test-key");

describe("getSessionUserId", () => {
  it("extracts user_id from github_scout_session cookie", async () => {
    const { getSessionUserId } = await import("../supabase");
    const request = {
      cookies: {
        get: (name: string) =>
          name === "github_scout_session"
            ? { value: "550e8400-e29b-41d4-a716-446655440000" }
            : undefined,
      },
    } as any;

    const userId = getSessionUserId(request);
    expect(userId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("returns 'anonymous' when no session cookie", async () => {
    const { getSessionUserId } = await import("../supabase");
    const request = {
      cookies: {
        get: () => undefined,
      },
    } as any;

    const userId = getSessionUserId(request);
    expect(userId).toBe("anonymous");
  });

  it("returns 'anonymous' when cookie value is invalid UUID", async () => {
    const { getSessionUserId } = await import("../supabase");
    const request = {
      cookies: {
        get: (name: string) =>
          name === "github_scout_session"
            ? { value: "not-a-valid-uuid" }
            : undefined,
      },
    } as any;

    const userId = getSessionUserId(request);
    expect(userId).toBe("anonymous");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/supabase.test.ts`
Expected: FAIL — `getSessionUserId` not exported

**Step 3: Write minimal implementation**

Replace `lib/supabase.ts` with:

```typescript
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { isValidSessionId } from "./session";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Client-side Supabase client (uses publishable key)
export const supabase = createClient(supabaseUrl, supabasePublishableKey);

// Server-side Supabase client (uses service role key, bypasses RLS)
export function createServerClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY!;
  return createClient(supabaseUrl, secretKey);
}

const SESSION_COOKIE_NAME = "github_scout_session";

// Extract user ID from session cookie on a server request
export function getSessionUserId(request: NextRequest): string {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME);
  const value = cookie?.value;
  if (value && isValidSessionId(value)) {
    return value;
  }
  return "anonymous";
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/supabase.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/supabase.ts lib/__tests__/supabase.test.ts
git commit -m "refactor: simplify supabase client to service role + add getSessionUserId helper"
```

---

### Task 2: Wire Phase 1 POST — save search to `searches` table

**Files:**
- Modify: `app/api/scout/route.ts` (POST handler, lines 157-191)

**Step 1: Write the code**

In `app/api/scout/route.ts`, add imports at the top:

```typescript
import { createServerClient, getSessionUserId } from "@/lib/supabase";
```

Replace the POST handler body (inside the try block, after mode detection) with:

```typescript
    const searchId = uuidv4();
    const userId = getSessionUserId(request);
    const trimmedQuery = query.trim();

    // Persist to Supabase
    const db = createServerClient();
    const { error: dbError } = await db.from("searches").insert({
      id: searchId,
      user_id: userId,
      query: trimmedQuery,
      mode,
    });

    if (dbError) {
      console.error("Failed to save search:", dbError);
      // Continue anyway — in-memory fallback still works
    }

    // Store the search params in a simple in-memory map for the GET handler
    pendingSearches.set(searchId, { query: trimmedQuery, mode });

    // Clean up old entries after 5 minutes
    setTimeout(() => pendingSearches.delete(searchId), 5 * 60 * 1000);

    return NextResponse.json({ id: searchId, mode });
```

**Step 2: Run dev server to verify no build errors**

Run: `npx next build --no-lint 2>&1 | head -20` (or just `npm run dev -- -p 3333` and check for errors)

**Step 3: Commit**

```bash
git add app/api/scout/route.ts
git commit -m "feat: persist Phase 1 search to Supabase on POST /api/scout"
```

---

### Task 3: Wire Phase 1 GET — save repos + observations on completion

**Files:**
- Modify: `app/api/scout/route.ts` (GET handler, inside the `.then()` callback, ~lines 303-365)

**Step 1: Write the code**

In the `.then((finalResponse) => { ... })` callback, after the `phase1_complete` SSE event is sent (after line 358), add the Supabase persistence block:

```typescript
            // Persist results to Supabase
            try {
              const db = createServerClient();

              // Save repos to search_results table
              if (dedupedRepos.length > 0) {
                const repoRows = dedupedRepos.map((r: RepoResult) => ({
                  search_id: searchId,
                  repo_url: r.repo_url,
                  repo_name: r.repo_name,
                  stars: r.stars,
                  last_commit: r.last_commit,
                  primary_language: r.primary_language,
                  license: r.license,
                  quality_tier: r.quality_tier,
                  verification: r.verification,
                  reddit_signal: r.reddit_signal,
                  summary: r.summary,
                  source_strategies: r.source_strategies,
                }));

                const { error: insertError } = await db
                  .from("search_results")
                  .insert(repoRows);

                if (insertError) {
                  console.error("Failed to save search results:", insertError);
                }
              }

              // Update search record with completion data
              const observations = Array.isArray(parsed.observations)
                ? parsed.observations.filter((o: unknown): o is string => typeof o === "string")
                : [];

              const { error: updateError } = await db
                .from("searches")
                .update({
                  phase1_complete: true,
                  topic_extracted: parsed.topic || query,
                  observations,
                })
                .eq("id", searchId);

              if (updateError) {
                console.error("Failed to update search:", updateError);
              }
            } catch (persistError) {
              console.error("Supabase persistence error:", persistError);
            }
```

**Important:** The `.then()` callback needs to be `async`. Change `.then((finalResponse) => {` to `.then(async (finalResponse) => {`.

**Step 2: Run dev server to verify no build errors**

Run: `npm run dev -- -p 3333` and verify the app loads without errors.

**Step 3: Commit**

```bash
git add app/api/scout/route.ts
git commit -m "feat: persist Phase 1 repos and observations to Supabase on stream complete"
```

---

### Task 4: Wire Phase 2 — upsert deep_dive JSONB, set phase2_complete

**Files:**
- Modify: `app/api/scout/[id]/deep-dive/route.ts`

**Step 1: Write the code**

Add import at the top of the file:

```typescript
import { createServerClient } from "@/lib/supabase";
```

After `send("deep_dive_complete", result);` (line 413), add:

```typescript
              // Persist deep dive to Supabase
              try {
                const db = createServerClient();
                const { error: upsertError } = await db
                  .from("search_results")
                  .update({ deep_dive: result })
                  .eq("search_id", id)
                  .eq("repo_url", repoUrl);

                if (upsertError) {
                  console.error("Failed to save deep dive:", upsertError);
                }
              } catch (e) {
                console.error("Deep dive persist error:", e);
              }
```

Also add the same block for the fallback result case. After `send("deep_dive_complete", fallbackResult);` (line 444), add:

```typescript
              // Persist fallback deep dive to Supabase
              try {
                const db = createServerClient();
                await db
                  .from("search_results")
                  .update({ deep_dive: fallbackResult })
                  .eq("search_id", id)
                  .eq("repo_url", repoUrl);
              } catch (e) {
                console.error("Fallback deep dive persist error:", e);
              }
```

After `send("summary", summary);` (line 468), add:

```typescript
            // Mark phase2 complete in Supabase
            try {
              const db = createServerClient();
              await db
                .from("searches")
                .update({ phase2_complete: true })
                .eq("id", id);
            } catch (e) {
              console.error("Phase2 complete persist error:", e);
            }
```

Also add the same after the fallback summary `send("summary", fallbackSummary);` (line 478):

```typescript
            try {
              const db = createServerClient();
              await db
                .from("searches")
                .update({ phase2_complete: true })
                .eq("id", id);
            } catch (e) {
              console.error("Phase2 complete persist error:", e);
            }
```

**Step 2: Verify no build errors**

Run: `npm run dev -- -p 3333`

**Step 3: Commit**

```bash
git add app/api/scout/[id]/deep-dive/route.ts
git commit -m "feat: persist deep dive results and phase2 completion to Supabase"
```

---

### Task 5: Wire feedback — insert into feedback table

**Files:**
- Modify: `app/api/feedback/route.ts`

**Step 1: Write the code**

Add import at top:

```typescript
import { createServerClient } from "@/lib/supabase";
```

Replace the `// TODO: Persist to Supabase once schema is ready` comment and the `return NextResponse.json({ success: true });` line (~lines 39-41) with:

```typescript
    // Persist to Supabase
    const db = createServerClient();
    const { error: dbError } = await db.from("feedback").insert({
      search_id,
      repo_url,
      signal,
      ...(comment ? { comment } : {}),
    });

    if (dbError) {
      console.error("Failed to save feedback:", dbError);
      return NextResponse.json(
        { error: "Failed to save feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
```

**Step 2: Verify no build errors**

Run: `npm run dev -- -p 3333`

**Step 3: Commit**

```bash
git add app/api/feedback/route.ts
git commit -m "feat: persist feedback to Supabase feedback table"
```

---

### Task 6: Wire history — replace in-memory with Supabase queries

**Files:**
- Modify: `app/api/history/route.ts`

**Step 1: Write the code**

Replace the entire file with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, getSessionUserId } from "@/lib/supabase";

const MAX_HISTORY_ITEMS = 20;

/** GET /api/history — Return recent searches for the current session */
export async function GET(request: NextRequest) {
  const userId = getSessionUserId(request);

  if (userId === "anonymous") {
    return NextResponse.json({ items: [] });
  }

  const db = createServerClient();

  const { data: searches, error } = await db
    .from("searches")
    .select("id, query, mode, phase2_complete, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY_ITEMS);

  if (error) {
    console.error("Failed to load history:", error);
    return NextResponse.json({ items: [] });
  }

  // Get repo counts per search
  const searchIds = searches.map((s: { id: string }) => s.id);
  const { data: counts, error: countError } = await db
    .from("search_results")
    .select("search_id")
    .in("search_id", searchIds);

  const repoCountMap = new Map<string, number>();
  if (!countError && counts) {
    for (const row of counts) {
      const current = repoCountMap.get(row.search_id) || 0;
      repoCountMap.set(row.search_id, current + 1);
    }
  }

  const items = searches.map((s: { id: string; query: string; mode: string; phase2_complete: boolean; created_at: string }) => ({
    id: s.id,
    query: s.query,
    mode: s.mode,
    repos_found: repoCountMap.get(s.id) || 0,
    created_at: s.created_at,
    phase2_complete: s.phase2_complete || false,
  }));

  return NextResponse.json({ items });
}
```

Note: The POST handler is removed — `POST /api/scout` already writes to `searches`.

**Step 2: Verify no build errors**

Run: `npm run dev -- -p 3333`

**Step 3: Check if POST /api/history is called anywhere and remove those calls**

Search for: `POST.*history` or `fetch("/api/history"` or `fetch('/api/history'` in the codebase. If found, remove those calls since POST /api/scout now handles persistence.

**Step 4: Commit**

```bash
git add app/api/history/route.ts
git commit -m "feat: wire history to Supabase, remove in-memory store"
```

---

### Task 7: New endpoint — GET /api/scout/[id]/results for loading saved results

**Files:**
- Create: `app/api/scout/[id]/results/route.ts`

**Step 1: Write the code**

Create the file:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing search ID" }, { status: 400 });
  }

  const db = createServerClient();

  // Fetch the search record
  const { data: search, error: searchError } = await db
    .from("searches")
    .select("*")
    .eq("id", id)
    .single();

  if (searchError || !search) {
    return NextResponse.json({ error: "Search not found" }, { status: 404 });
  }

  // Fetch associated results
  const { data: results, error: resultsError } = await db
    .from("search_results")
    .select("*")
    .eq("search_id", id)
    .order("created_at", { ascending: true });

  if (resultsError) {
    console.error("Failed to load results:", resultsError);
    return NextResponse.json(
      { error: "Failed to load results" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    search: {
      id: search.id,
      query: search.query,
      mode: search.mode,
      topic_extracted: search.topic_extracted,
      observations: search.observations || [],
      phase1_complete: search.phase1_complete || false,
      phase2_complete: search.phase2_complete || false,
      created_at: search.created_at,
    },
    results: (results || []).map((r: Record<string, unknown>) => ({
      repo_url: r.repo_url,
      repo_name: r.repo_name,
      stars: r.stars,
      last_commit: r.last_commit,
      primary_language: r.primary_language,
      license: r.license,
      quality_tier: r.quality_tier,
      verification: r.verification || {},
      reddit_signal: r.reddit_signal || "no_data",
      summary: r.summary || "",
      source_strategies: r.source_strategies || [],
      is_selected: false,
      deep_dive: r.deep_dive || null,
    })),
  });
}
```

**Step 2: Verify the endpoint works**

Run: `npm run dev -- -p 3333`
Test: `curl http://localhost:3333/api/scout/nonexistent-id/results` — should return 404.

**Step 3: Commit**

```bash
git add app/api/scout/[id]/results/route.ts
git commit -m "feat: add GET /api/scout/[id]/results endpoint for loading saved searches"
```

---

### Task 8: Client — load saved results on mount before SSE fallback

**Files:**
- Modify: `hooks/useScoutStream.ts`

**Step 1: Write the code**

In `hooks/useScoutStream.ts`, add a check for saved results before connecting to SSE. Replace the `useEffect` body (everything inside the `useEffect(() => { ... }, [searchId])`) with:

```typescript
  useEffect(() => {
    if (!searchId) return;

    let cancelled = false;

    // Try loading saved results first
    (async () => {
      try {
        const res = await fetch(`/api/scout/${searchId}/results`);
        if (res.ok && !cancelled) {
          const data = await res.json();

          // If phase1 is complete, hydrate store from DB
          if (data.search?.phase1_complete) {
            store.setMode(data.search.mode);

            for (const obs of data.search.observations || []) {
              store.addObservation(obs);
            }

            for (const repo of data.results || []) {
              store.addRepo(repo);

              // If deep dive data exists, populate it
              if (repo.deep_dive) {
                store.addDeepDiveResult(repo.deep_dive);
              }
            }

            store.setPhase1Complete(true);
            store.setIsSearching(false);

            if (data.search.phase2_complete) {
              store.setPhase2Complete(true);
            }

            setIsComplete(true);
            return; // Don't connect to SSE
          }
        }
      } catch {
        // Failed to load saved results, fall back to SSE
      }

      if (cancelled) return;

      // Fall back to SSE stream
      const connect = () => {
        const es = new EventSource(`/api/scout?id=${searchId}`);
        eventSourceRef.current = es;

        es.onopen = () => {
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;
        };

        es.addEventListener("mode_detected", (e) => {
          const data = JSON.parse(e.data);
          store.setMode(data.mode);
        });

        es.addEventListener("search_progress", (e) => {
          const data = JSON.parse(e.data);
          store.addSearchProgress(data);
        });

        es.addEventListener("repo_discovered", (e) => {
          const data = JSON.parse(e.data);
          store.addRepo(data);
        });

        es.addEventListener("verification_update", (e) => {
          const data = JSON.parse(e.data);
          store.updateRepoVerification(data.repo_url, data.verification);
        });

        es.addEventListener("observation", (e) => {
          const data = JSON.parse(e.data);
          store.addObservation(data.text);
        });

        es.addEventListener("curated_list", (e) => {
          const data = JSON.parse(e.data);
          store.addCuratedList(data);
        });

        es.addEventListener("industry_tool", (e) => {
          const data = JSON.parse(e.data);
          store.addIndustryTool(data);
        });

        es.addEventListener("phase1_complete", () => {
          setIsComplete(true);
          store.setPhase1Complete(true);
          store.setIsSearching(false);
          es.close();
        });

        es.onerror = () => {
          if (reconnectAttemptsRef.current < 3) {
            reconnectAttemptsRef.current += 1;
            es.close();
            setTimeout(connect, 1000 * reconnectAttemptsRef.current);
          } else {
            setError("Connection lost. Please refresh the page.");
            setIsConnected(false);
          }
        };
      };

      connect();
    })();

    return () => {
      cancelled = true;
      eventSourceRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchId]);
```

**Step 2: Verify no build errors**

Run: `npm run dev -- -p 3333`

**Step 3: Commit**

```bash
git add hooks/useScoutStream.ts
git commit -m "feat: load saved results from Supabase before falling back to SSE"
```

---

### Task 9: Place FeedbackWidget in RepoRow and DeepDiveCard

**Files:**
- Modify: `components/results/RepoRow.tsx`
- Modify: `components/deep-dive/DeepDiveCard.tsx`

**Step 1: Add FeedbackWidget to RepoRow**

In `components/results/RepoRow.tsx`:

Add import:
```typescript
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { useScoutStore } from "@/stores/scout-store";
```

Note: `useScoutStore` is already imported, so just add the `FeedbackWidget` import.

The RepoRow needs `searchId`. Get it from the store. Add inside the component function, after the existing store selectors:

```typescript
  const searchMeta = useScoutStore((s) => s.searchMeta);
```

In the expanded section (inside the `{expanded && ( ... )}` block), after the `<div className="flex flex-wrap gap-4 ...">` that contains license/freshness/source_strategies, add:

```tsx
              {searchMeta && (
                <div className="pt-2">
                  <FeedbackWidget
                    searchId={searchMeta.id}
                    repoUrl={repo.repo_url}
                  />
                </div>
              )}
```

**Step 2: Add FeedbackWidget to DeepDiveCard**

In `components/deep-dive/DeepDiveCard.tsx`:

Add imports:
```typescript
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { useScoutStore } from "@/stores/scout-store";
```

Inside the `DeepDiveCard` component function, add:
```typescript
  const searchMeta = useScoutStore((s) => s.searchMeta);
```

In the `<CardHeader>`, after the meta row `<div className="flex flex-wrap items-center gap-x-3 ...">` closes, add:

```tsx
          {/* Feedback */}
          {searchMeta && (
            <FeedbackWidget
              searchId={searchMeta.id}
              repoUrl={result.repo_url}
            />
          )}
```

**Step 3: Check that searchMeta.id is populated**

The `searchMeta` is set in the scout store. Check if `useScoutStream` or the search page sets it. If `searchMeta` is not being set, we need to add `store.setSearchMeta(...)` in the stream hook or the results client.

Look at `ScoutResultsClient.tsx` — if `searchMeta` is never set, add to `useScoutStream.ts` inside the `mode_detected` handler:

```typescript
        store.setSearchMeta({
          id: searchId,
          query: data.topic || "",
          mode: data.mode,
          topic_extracted: data.topic || "",
          searches_performed: 0,
          repos_evaluated: 0,
          repos_verified: 0,
          created_at: new Date().toISOString(),
        });
```

And in the saved results hydration path (Task 8), add:
```typescript
            store.setSearchMeta({
              id: searchId,
              query: data.search.query,
              mode: data.search.mode,
              topic_extracted: data.search.topic_extracted || data.search.query,
              searches_performed: 0,
              repos_evaluated: data.results?.length || 0,
              repos_verified: 0,
              created_at: data.search.created_at,
            });
```

**Step 4: Verify no build errors**

Run: `npm run dev -- -p 3333`

**Step 5: Commit**

```bash
git add components/results/RepoRow.tsx components/deep-dive/DeepDiveCard.tsx hooks/useScoutStream.ts
git commit -m "feat: wire FeedbackWidget into RepoRow and DeepDiveCard"
```

---

### Task 10: Place ExportButton in results page

**Files:**
- Modify: `app/scout/[id]/ScoutResultsClient.tsx`

**Step 1: Write the code**

Add import:
```typescript
import { ExportButton } from "@/components/export/ExportButton";
```

Add store selectors (some already exist, add `repos` and `searchMeta`):
```typescript
  const repos = useScoutStore((s) => s.repos);
  const searchMeta = useScoutStore((s) => s.searchMeta);
  const phase1Complete = useScoutStore((s) => s.phase1Complete);
```

Note: `phase1Complete` might not exist yet as a selector. Check the store — `phase1Complete` is in the store state.

Add the ExportButton after the `<StreamingProgress />` component and before the main content grid:

```tsx
        {/* Export button — visible after Phase 1 completes */}
        {phase1Complete && repos.length > 0 && (
          <div className="flex justify-end">
            <ExportButton
              repos={repos}
              deepDiveResults={deepDiveResults.length > 0 ? deepDiveResults : undefined}
              query={searchMeta?.query || ""}
            />
          </div>
        )}
```

**Step 2: Verify no build errors**

Run: `npm run dev -- -p 3333`

**Step 3: Commit**

```bash
git add app/scout/[id]/ScoutResultsClient.tsx
git commit -m "feat: wire ExportButton into results page"
```

---

### Task 11: Run all tests and verify

**Files:** None (verification only)

**Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass (43 existing + new supabase test)

**Step 2: Manual smoke test**

1. Start dev server: `npm run dev -- -p 3333`
2. Open `http://localhost:3333`
3. Run a search query
4. Verify repos appear in the table
5. Expand a repo row — verify FeedbackWidget appears
6. Verify ExportButton appears after Phase 1 completes
7. Select repos and run deep dive
8. Verify FeedbackWidget appears on DeepDiveCards
9. Check Supabase dashboard — verify rows in `searches`, `search_results`
10. Navigate away and back to `/scout/[id]` — verify results load from DB

**Step 3: Update tracker**

Update `docs/plans/2026-02-26-supabase-persistence-tracker.md` — mark all tasks as `done`.

**Step 4: Final commit**

```bash
git add docs/plans/2026-02-26-supabase-persistence-tracker.md
git commit -m "docs: mark all Supabase persistence tasks as complete"
```
