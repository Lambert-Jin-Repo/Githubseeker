# Admin Panel — API Usage Monitoring Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an admin panel that monitors API usage, token consumption, costs, latency, errors, and search analytics with real-time Recharts dashboard.

**Architecture:** Fire-and-forget logging on every API call (MiniMax, Serper, GitHub fetch) into `api_usage_logs` Supabase table. Admin-only dashboard at `/admin/llm-usage` with Supabase Auth + `is_admin` flag. Recharts for visualization. Mirrors AI News Station pattern with elevated interactive UI.

**Tech Stack:** Next.js App Router, Supabase (auth + DB), Recharts, Zustand (existing), Tailwind CSS v4

**Design doc:** `docs/plans/2026-03-05-admin-panel-design.md`

**Reference:** AI News Station admin panel at `/Users/liangbojin/Desktop/MyProject/AI News Station/ai-news-hub/src/app/admin/`

**Pricing constants:**
- MiniMax M2.5: $0.30/1M input tokens, $1.20/1M output tokens
- Serper: $1.00/1K queries
- GitHub fetch: $0 (latency tracking only)

---

## Task 1: Database Migration — `api_usage_logs` table + profiles update

**Files:**
- Apply via Supabase MCP: migration `create_api_usage_logs`

**Step 1: Apply the migration via Supabase MCP**

```sql
-- api_usage_logs: tracks every API call (LLM, Serper, GitHub fetch)
CREATE TABLE api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_id UUID REFERENCES searches(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT,
  operation TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  latency_ms INTEGER,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd NUMERIC(10,6),
  error_type TEXT,
  tool_round INTEGER,
  metadata JSONB
);

CREATE INDEX idx_api_usage_created_at ON api_usage_logs(created_at);
CREATE INDEX idx_api_usage_provider ON api_usage_logs(provider);
CREATE INDEX idx_api_usage_search_id ON api_usage_logs(search_id);

-- RLS: service_role only (no public access)
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Add is_admin flag to profiles (may already exist from OAuth setup)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Cleanup function: delete logs older than 30 days
CREATE OR REPLACE FUNCTION cleanup_old_api_usage_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM api_usage_logs WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 2: Verify migration applied**

Run `list_tables` via MCP to confirm `api_usage_logs` exists with correct columns.

**Step 3: Set yourself as admin**

```sql
UPDATE profiles SET is_admin = true WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL' LIMIT 1);
```

**Step 4: Commit** (no file changes — migration is in Supabase)

---

## Task 2: Logging Infrastructure — `lib/api-logger.ts`

**Files:**
- Create: `lib/api-logger.ts`
- Test: `lib/__tests__/api-logger.test.ts`

**Step 1: Write the failing test**

```typescript
// lib/__tests__/api-logger.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase before importing logger
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn(() => ({ insert: mockInsert }));
vi.mock("@/lib/supabase", () => ({
  createServerClient: () => ({ from: mockFrom }),
}));

import {
  logLLMCall,
  logSerperCall,
  logGitHubFetch,
  calculateLLMCost,
} from "../api-logger";

describe("api-logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateLLMCost", () => {
    it("calculates MiniMax M2.5 cost correctly", () => {
      // 1000 input tokens = $0.0003, 1000 output tokens = $0.0012
      const cost = calculateLLMCost("minimax", 1000, 1000);
      expect(cost).toBeCloseTo(0.0015, 6);
    });

    it("returns 0 for unknown provider", () => {
      expect(calculateLLMCost("unknown", 1000, 1000)).toBe(0);
    });

    it("handles zero tokens", () => {
      expect(calculateLLMCost("minimax", 0, 0)).toBe(0);
    });
  });

  describe("logLLMCall", () => {
    it("inserts into api_usage_logs with correct fields", async () => {
      logLLMCall({
        searchId: "test-id",
        operation: "phase1_search",
        model: "MiniMax-M2.5",
        provider: "minimax",
        success: true,
        latencyMs: 5000,
        tokensIn: 500,
        tokensOut: 200,
        toolRound: 1,
      });

      // Fire-and-forget — wait a tick for the async insert
      await new Promise((r) => setTimeout(r, 10));

      expect(mockFrom).toHaveBeenCalledWith("api_usage_logs");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          search_id: "test-id",
          provider: "minimax",
          model: "MiniMax-M2.5",
          operation: "phase1_search",
          success: true,
          latency_ms: 5000,
          tokens_in: 500,
          tokens_out: 200,
          tool_round: 1,
        })
      );
      // Verify cost was calculated
      const inserted = mockInsert.mock.calls[0][0];
      expect(inserted.cost_usd).toBeGreaterThan(0);
    });
  });

  describe("logSerperCall", () => {
    it("inserts with provider serper and calculates cost", async () => {
      logSerperCall({
        searchId: "test-id",
        query: "test query",
        success: true,
        latencyMs: 800,
        resultCount: 20,
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "serper",
          operation: "web_search",
          success: true,
          latency_ms: 800,
          cost_usd: expect.any(Number),
          metadata: expect.objectContaining({ query: "test query", result_count: 20 }),
        })
      );
    });
  });

  describe("logGitHubFetch", () => {
    it("inserts with provider github and zero cost", async () => {
      logGitHubFetch({
        searchId: "test-id",
        url: "https://github.com/owner/repo",
        success: true,
        latencyMs: 300,
      });

      await new Promise((r) => setTimeout(r, 10));

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "github",
          operation: "web_fetch",
          cost_usd: 0,
        })
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/api-logger.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// lib/api-logger.ts
import { createServerClient } from "@/lib/supabase";

// Pricing constants (per token)
const PRICING: Record<string, { input: number; output: number }> = {
  minimax: { input: 0.30 / 1_000_000, output: 1.20 / 1_000_000 },
  openai: { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
  deepseek: { input: 0.14 / 1_000_000, output: 0.28 / 1_000_000 },
};

const SERPER_COST_PER_QUERY = 1.0 / 1000; // $1.00 per 1K queries

export function calculateLLMCost(
  provider: string,
  tokensIn: number,
  tokensOut: number
): number {
  const rates = PRICING[provider];
  if (!rates) return 0;
  return tokensIn * rates.input + tokensOut * rates.output;
}

interface LLMCallParams {
  searchId?: string | null;
  operation: string;
  model: string;
  provider: string;
  success: boolean;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  errorType?: string;
  toolRound?: number;
}

/** Fire-and-forget — never blocks the caller. */
export function logLLMCall(params: LLMCallParams): void {
  try {
    const cost = calculateLLMCost(
      params.provider,
      params.tokensIn || 0,
      params.tokensOut || 0
    );
    const supabase = createServerClient();
    supabase
      .from("api_usage_logs")
      .insert({
        search_id: params.searchId || null,
        provider: params.provider,
        model: params.model,
        operation: params.operation,
        success: params.success,
        latency_ms: params.latencyMs,
        tokens_in: params.tokensIn || null,
        tokens_out: params.tokensOut || null,
        cost_usd: cost,
        error_type: params.errorType || null,
        tool_round: params.toolRound || null,
      })
      .then(({ error }) => {
        if (error) console.error("[api-logger] Failed to log LLM call:", error.message);
      });
  } catch {
    // Supabase client may not be available (tests/build)
  }
}

interface SerperCallParams {
  searchId?: string | null;
  query: string;
  success: boolean;
  latencyMs: number;
  resultCount?: number;
  errorType?: string;
}

export function logSerperCall(params: SerperCallParams): void {
  try {
    const supabase = createServerClient();
    supabase
      .from("api_usage_logs")
      .insert({
        search_id: params.searchId || null,
        provider: "serper",
        model: null,
        operation: "web_search",
        success: params.success,
        latency_ms: params.latencyMs,
        tokens_in: null,
        tokens_out: null,
        cost_usd: SERPER_COST_PER_QUERY,
        error_type: params.errorType || null,
        tool_round: null,
        metadata: { query: params.query, result_count: params.resultCount || 0 },
      })
      .then(({ error }) => {
        if (error) console.error("[api-logger] Failed to log Serper call:", error.message);
      });
  } catch {}
}

interface GitHubFetchParams {
  searchId?: string | null;
  url: string;
  success: boolean;
  latencyMs: number;
  errorType?: string;
}

export function logGitHubFetch(params: GitHubFetchParams): void {
  try {
    const supabase = createServerClient();
    supabase
      .from("api_usage_logs")
      .insert({
        search_id: params.searchId || null,
        provider: "github",
        model: null,
        operation: "web_fetch",
        success: params.success,
        latency_ms: params.latencyMs,
        tokens_in: null,
        tokens_out: null,
        cost_usd: 0,
        error_type: params.errorType || null,
        tool_round: null,
        metadata: { url: params.url },
      })
      .then(({ error }) => {
        if (error) console.error("[api-logger] Failed to log GitHub fetch:", error.message);
      });
  } catch {}
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/api-logger.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/api-logger.ts lib/__tests__/api-logger.test.ts
git commit -m "feat: add fire-and-forget API usage logger with cost calculation"
```

---

## Task 3: Integrate Logging into `lib/llm.ts`

**Files:**
- Modify: `lib/llm.ts`

**Step 1: Add searchId parameter and token extraction**

Changes to `callLLMWithTools`:
1. Add `searchId?: string` to `LLMCallOptions` interface
2. After each `getClient().chat.completions.create()` call, extract `response.usage` and measure latency
3. Call `logLLMCall()` fire-and-forget after each LLM round
4. Pass `searchId` through for correlation

Key integration points:
- Line ~127 (main loop LLM call): wrap with `performance.now()` timing, extract `response.usage.prompt_tokens` and `response.usage.completion_tokens`
- Line ~202 (final no-tools call): same pattern
- Line ~112 (pure completion mode): same pattern

```typescript
// Add to imports:
import { logLLMCall } from "./api-logger";

// Add to LLMCallOptions interface:
searchId?: string;

// After each chat.completions.create() call, add:
const startTime = performance.now();
const response = await getClient().chat.completions.create({ ... });
const latencyMs = Math.round(performance.now() - startTime);

logLLMCall({
  searchId: options.searchId,
  operation: options.operation || "llm_call",
  model: MODEL,
  provider: provider.name,
  success: true,
  latencyMs,
  tokensIn: response.usage?.prompt_tokens,
  tokensOut: response.usage?.completion_tokens,
  toolRound: round + 1,
});
```

Also add `operation?: string` to `LLMCallOptions` for distinguishing phase1_search vs deep_dive_v2.

**Step 2: Handle errors — log failed calls too**

Wrap the LLM call in try/catch, log with `success: false` and `errorType` on failure, then re-throw.

**Step 3: Run existing tests**

Run: `npx vitest run`
Expected: All tests pass (logging is fire-and-forget, won't affect mocked tests)

**Step 4: Commit**

```bash
git add lib/llm.ts
git commit -m "feat: integrate API usage logging into LLM agentic loop"
```

---

## Task 4: Integrate Logging into `lib/web-search.ts`

**Files:**
- Modify: `lib/web-search.ts`

**Step 1: Add logging to `webSearch()`**

```typescript
import { logSerperCall, logGitHubFetch } from "./api-logger";

// Add optional searchId parameter to webSearch:
export async function webSearch(
  query: string,
  count: number = 20,
  searchId?: string
): Promise<WebSearchResult[]> {
  const startTime = performance.now();
  try {
    const response = await fetch(SERPER_API_URL, { ... });
    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logSerperCall({ searchId, query, success: false, latencyMs, errorType: `http_${response.status}` });
      throw new Error(`Serper API error: ${response.status} ${body}`.trim());
    }

    const data = await response.json();
    const results = (data.organic || []).map(...);
    logSerperCall({ searchId, query, success: true, latencyMs, resultCount: results.length });
    return results;
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startTime);
    if (!(err instanceof Error && err.message.startsWith("Serper API error"))) {
      logSerperCall({ searchId, query, success: false, latencyMs, errorType: "network" });
    }
    throw err;
  }
}
```

**Step 2: Add logging to `fetchGitHubMetadata()` and `fetchWebPage()`**

Same pattern: measure latency, log success/failure with `logGitHubFetch()`. Add optional `searchId` parameter.

**Step 3: Update `executeToolCall` in `lib/llm.ts` to pass searchId**

The `executeToolCall` function needs access to `searchId` to pass to `webSearch` and `fetchGitHubMetadata`. Move it inside `callLLMWithTools` or pass `searchId` as a closure.

**Step 4: Run existing tests**

Run: `npx vitest run`
Expected: All pass

**Step 5: Commit**

```bash
git add lib/web-search.ts lib/llm.ts
git commit -m "feat: integrate API usage logging into Serper and GitHub fetch"
```

---

## Task 5: Pass `searchId` from Route Handlers

**Files:**
- Modify: `app/api/scout/route.ts` — pass `searchId` to `callLLMWithTools`
- Modify: `app/api/scout/[id]/deep-dive-v2/route.ts` — pass `searchId` to analyzer

**Step 1: Update scout route GET handler**

In the `callLLMWithTools` call (line ~347), add `searchId` and `operation`:

```typescript
callLLMWithTools({
  systemPrompt: buildSystemPrompt(mode, isVagueQuery),
  userMessage: buildUserMessage(query, mode),
  searchId,              // NEW
  operation: "phase1_search",  // NEW
  onToolError(toolName, error) { ... },
  ...
})
```

**Step 2: Update deep-dive-v2 route**

Pass `searchId` to the analyzer calls so deep dive LLM calls are also logged.

**Step 3: Run existing tests**

Run: `npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add app/api/scout/route.ts app/api/scout/[id]/deep-dive-v2/route.ts
git commit -m "feat: pass searchId to logging for API call correlation"
```

---

## Task 6: Admin Auth Middleware — `lib/admin-auth.ts`

**Files:**
- Create: `lib/admin-auth.ts`
- Test: `lib/__tests__/admin-auth.test.ts`

**Step 1: Write the failing test**

```typescript
// lib/__tests__/admin-auth.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createAuthServerClient: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  createServerClient: vi.fn(),
}));

import { verifyAdmin } from "../admin-auth";

describe("verifyAdmin", () => {
  it("returns error for unauthenticated user", async () => {
    const { createAuthServerClient } = await import("@/lib/supabase/server");
    (createAuthServerClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: () => ({ data: { user: null }, error: { message: "No session" } }) },
    });

    const result = await verifyAdmin();
    expect(result).toEqual({ authorized: false, status: 401, error: "Unauthorized" });
  });

  it("returns error for non-admin user", async () => {
    const { createAuthServerClient } = await import("@/lib/supabase/server");
    (createAuthServerClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: () => ({ data: { user: { id: "user-1" } }, error: null }) },
    });

    const { createServerClient } = await import("@/lib/supabase");
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => ({ data: { is_admin: false }, error: null }),
          }),
        }),
      }),
    });

    const result = await verifyAdmin();
    expect(result).toEqual({ authorized: false, status: 403, error: "Forbidden — admin access required" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/admin-auth.test.ts`

**Step 3: Write the implementation**

```typescript
// lib/admin-auth.ts
import { createAuthServerClient } from "@/lib/supabase/server";
import { createServerClient } from "@/lib/supabase";

interface AdminCheckResult {
  authorized: boolean;
  userId?: string;
  status?: number;
  error?: string;
}

export async function verifyAdmin(): Promise<AdminCheckResult> {
  const authClient = await createAuthServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();

  if (authError || !user) {
    return { authorized: false, status: 401, error: "Unauthorized" };
  }

  const admin = createServerClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return { authorized: false, status: 403, error: "Forbidden — admin access required" };
  }

  return { authorized: true, userId: user.id };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/admin-auth.test.ts`

**Step 5: Commit**

```bash
git add lib/admin-auth.ts lib/__tests__/admin-auth.test.ts
git commit -m "feat: add admin auth verification middleware"
```

---

## Task 7: Metrics API Endpoint — `GET /api/admin/metrics`

**Files:**
- Create: `app/api/admin/metrics/route.ts`

**Step 1: Write the endpoint**

Adapt the AI News Station `llm-usage/route.ts` pattern. Key differences:
- Table is `api_usage_logs` (not `llm_usage_logs`)
- Fields: `operation` (not `feature`), `cost_usd`, `tool_round`, `metadata`
- Add `totalCostUsd` and `totalSearches` to summary
- Group by `operation` instead of `feature`
- Include cost in timeline buckets
- Use `verifyAdmin()` helper

Returns:
```typescript
{
  summary: { totalCalls, successRate, avgLatencyMs, totalTokensIn, totalTokensOut, totalCostUsd, totalSearches },
  byProvider: [{ provider, calls, successRate, avgLatencyMs, totalCost }],
  byOperation: [{ operation, calls, avgLatencyMs, totalCost }],
  timeline: [{ time, minimax?, serper?, github?, cost? }],
  errors: [{ time, provider, operation, error_type }],
  recentCalls: [{ created_at, provider, model, operation, success, latency_ms, tokens_in, tokens_out, cost_usd, error_type, tool_round }],
}
```

**Step 2: Test manually**

Run dev server, call `curl http://localhost:3333/api/admin/metrics?range=today` (will return 401 without auth — expected).

**Step 3: Commit**

```bash
git add app/api/admin/metrics/route.ts
git commit -m "feat: add admin metrics API endpoint"
```

---

## Task 8: Search Analytics Endpoint — `GET /api/admin/search-analytics`

**Files:**
- Create: `app/api/admin/search-analytics/route.ts`

**Step 1: Write the endpoint**

Queries `searches` table joined with `api_usage_logs`:
- Searches per day (count grouped by date)
- Mode distribution (count by mode)
- Avg repos per search (from `search_results` count)
- Top topics (from `topic_extracted`, grouped + counted)
- Cache hit rate (count of cached=true POST responses — track via metadata or infer from 24h duplicates)
- Cost per search (SUM `cost_usd` grouped by `search_id`)

Uses `verifyAdmin()` for auth.

**Step 2: Commit**

```bash
git add app/api/admin/search-analytics/route.ts
git commit -m "feat: add admin search analytics API endpoint"
```

---

## Task 9: Install Recharts

**Step 1: Install dependency**

```bash
npm install recharts
```

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install recharts for admin dashboard charts"
```

---

## Task 10: Admin Login Page

**Files:**
- Create: `app/admin/login/page.tsx`

**Step 1: Write the login page**

Adapt the AI News Station login page. Key changes:
- Use project design tokens (teal accent, warm off-white bg, Literata/Atkinson fonts)
- Use existing Supabase browser client from `@supabase/ssr`
- Redirect to `/admin/llm-usage` on success
- Professional styling with hover/focus transitions

**Step 2: Test in browser**

Navigate to `http://localhost:3333/admin/login`, verify form renders.

**Step 3: Commit**

```bash
git add app/admin/login/page.tsx
git commit -m "feat: add admin login page with Supabase Auth"
```

---

## Task 11: Dashboard Page — `app/admin/llm-usage/page.tsx`

**Files:**
- Create: `app/admin/llm-usage/page.tsx`

**Step 1: Write the dashboard page**

Adapt AI News Station pattern with these enhancements:
- 6 metric cards (add Total Cost and Total Searches)
- Time range filter (Today / 7 Days / 30 Days)
- Auto-refresh toggle (15s)
- Fetch from both `/api/admin/metrics` and `/api/admin/search-analytics`
- Professional layout: max-w-7xl, card grid, responsive 2-col for charts
- Loading skeleton states

**Step 2: Commit**

```bash
git add app/admin/llm-usage/page.tsx
git commit -m "feat: add admin dashboard page with data fetching"
```

---

## Task 12: Dashboard Components — Charts & Cards

**Files:**
- Create: `app/admin/llm-usage/components/MetricCards.tsx`
- Create: `app/admin/llm-usage/components/TimeRangeFilter.tsx`
- Create: `app/admin/llm-usage/components/CostTimelineChart.tsx`
- Create: `app/admin/llm-usage/components/ProviderBreakdownChart.tsx`
- Create: `app/admin/llm-usage/components/OperationBarChart.tsx`
- Create: `app/admin/llm-usage/components/ErrorRateChart.tsx`
- Create: `app/admin/llm-usage/components/SearchAnalyticsPanel.tsx`
- Create: `app/admin/llm-usage/components/RecentCallsTable.tsx`
- Create: `app/admin/llm-usage/components/index.ts` (barrel export)

**Step 1: MetricCards**

6 cards with animated count-up effect (use `useEffect` + `requestAnimationFrame`), sparkline mini-trend, color-coded (green for good metrics, red for high error rate). Hover lift + subtle glow via Tailwind transitions.

Provider colors:
```typescript
const PROVIDER_COLORS = {
  minimax: "#0F766E",  // teal (project accent)
  serper: "#F59E0B",   // amber
  github: "#6366F1",   // indigo
};
```

**Step 2: TimeRangeFilter**

Toggle pills with active state (teal bg, white text). Auto-refresh checkbox with spinning indicator.

**Step 3: CostTimelineChart**

Stacked area chart: MiniMax cost (teal) + Serper cost (amber) over time. Crosshair tooltip showing formatted $ values.

**Step 4: ProviderBreakdownChart**

Donut/pie chart with inner label showing total calls. Hover shows percentage + call count.

**Step 5: OperationBarChart**

Horizontal bar chart: phase1_search, deep_dive_v2, web_search, web_fetch. Show calls count + avg latency as dual-axis or tooltip.

**Step 6: ErrorRateChart**

Line chart showing error count over time, colored by error_type (rate_limit = red, timeout = orange, parse_error = yellow).

**Step 7: SearchAnalyticsPanel**

Grid of mini-cards: mode distribution (mini pie), top 5 topics (list), avg repos/search (number), cache hit rate (percentage with ring).

**Step 8: RecentCallsTable**

Sortable table with provider badge (colored pill), expandable rows showing metadata JSON. Columns: Time, Provider, Operation, Latency, Tokens, Cost, Status.

**Step 9: Run the full app**

Start dev server, trigger a search, navigate to `/admin/llm-usage`. Verify:
- Metric cards show real data
- Charts render with actual API call logs
- Table shows recent calls
- Time range filter works
- Auto-refresh updates data

**Step 10: Commit**

```bash
git add app/admin/llm-usage/components/
git commit -m "feat: add admin dashboard chart and card components"
```

---

## Task 13: Final Polish & Verification

**Files:**
- Modify: various (minor adjustments)

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (256+ existing + new api-logger + admin-auth tests)

**Step 2: Test end-to-end flow**

1. Start dev server on port 3333
2. Perform a search (triggers LLM + Serper + GitHub logging)
3. Navigate to `/admin/login`, sign in
4. Navigate to `/admin/llm-usage`
5. Verify: metric cards, charts, table all show real data from the search
6. Switch time ranges, verify data updates
7. Toggle auto-refresh, verify 15s updates

**Step 3: Run security advisors**

Check Supabase advisors for RLS issues on the new table.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: admin panel — API usage monitoring dashboard (complete)"
```

**Step 5: Push to main**

```bash
git push origin main
```

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|---------------|
| 1 | Database migration | — (Supabase MCP) | — |
| 2 | API logger | `lib/api-logger.ts`, test | — |
| 3 | Logging in LLM | — | `lib/llm.ts` |
| 4 | Logging in web-search | — | `lib/web-search.ts`, `lib/llm.ts` |
| 5 | Pass searchId from routes | — | `app/api/scout/route.ts`, deep-dive-v2 route |
| 6 | Admin auth middleware | `lib/admin-auth.ts`, test | — |
| 7 | Metrics API endpoint | `app/api/admin/metrics/route.ts` | — |
| 8 | Search analytics endpoint | `app/api/admin/search-analytics/route.ts` | — |
| 9 | Install Recharts | — | `package.json` |
| 10 | Admin login page | `app/admin/login/page.tsx` | — |
| 11 | Dashboard page | `app/admin/llm-usage/page.tsx` | — |
| 12 | Dashboard components | 9 component files | — |
| 13 | Final polish & verification | — | various |

**Total: ~15 new files, ~4 modified files, 13 tasks**
