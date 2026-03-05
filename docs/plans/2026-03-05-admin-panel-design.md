# Admin Panel — API Usage Monitoring Dashboard

**Date:** 2026-03-05
**Status:** Approved
**Reference:** AI News Station admin panel (`/src/app/admin/llm-usage/`)

---

## Overview

Admin panel for monitoring API usage, token consumption, costs, latency, errors, and search analytics. Mirrors the AI News Station pattern (fire-and-forget logging, Recharts dashboard, Supabase admin auth) with elevated interactive UI.

## Pricing Constants

- **MiniMax M2.5:** $0.30/1M input tokens, $1.20/1M output tokens
- **Serper:** ~$1.00/1K queries
- **GitHub fetch:** No token cost (latency tracking only)

---

## 1. Database Schema

### New table: `api_usage_logs`

```sql
CREATE TABLE api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_id UUID REFERENCES searches(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,        -- 'minimax' | 'serper' | 'github'
  model TEXT,                    -- 'MiniMax-M2.5' | null for serper/github
  operation TEXT NOT NULL,       -- 'phase1_search' | 'deep_dive_v2' | 'web_search' | 'web_fetch'
  success BOOLEAN NOT NULL DEFAULT true,
  latency_ms INTEGER,
  tokens_in INTEGER,             -- null for non-LLM calls
  tokens_out INTEGER,
  cost_usd NUMERIC(10,6),       -- calculated at insert time
  error_type TEXT,               -- 'rate_limit' | 'timeout' | 'parse_error' | null
  tool_round INTEGER,            -- which agentic round (1-10), null for serper
  metadata JSONB                 -- flexible: serper query, tool name, etc.
);

CREATE INDEX idx_api_usage_created_at ON api_usage_logs(created_at);
CREATE INDEX idx_api_usage_provider ON api_usage_logs(provider);
CREATE INDEX idx_api_usage_search_id ON api_usage_logs(search_id);
```

### Profiles table update

Add `is_admin` flag for admin authorization:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
```

### Auto-cleanup (30 days)

```sql
CREATE OR REPLACE FUNCTION cleanup_old_api_usage_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM api_usage_logs WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql;
```

### RLS

- Service role only on `api_usage_logs` (no public access)
- Users can read their own profile row

---

## 2. Logging Infrastructure

### `lib/api-logger.ts`

Fire-and-forget async logger (never blocks caller):

- `logLLMCall({ searchId, operation, model, success, latencyMs, tokensIn, tokensOut, errorType, toolRound })` — calculates cost_usd from pricing constants
- `logSerperCall({ searchId, query, success, latencyMs, resultCount })` — cost per query
- `logGitHubFetch({ searchId, url, success, latencyMs })` — latency only

### Integration points

1. **`lib/llm.ts`** — After each `chat.completions.create()`:
   - Extract `response.usage.prompt_tokens` + `response.usage.completion_tokens`
   - Measure latency via `performance.now()`
   - Call `logLLMCall()` with round number
   - Accept optional `searchId` parameter in `callLLMWithTools`

2. **`lib/web-search.ts`** — After `webSearch()`: call `logSerperCall()`

3. **`lib/web-search.ts`** — After `fetchGitHubMetadata()` / `fetchWebPage()`: call `logGitHubFetch()`

---

## 3. API Endpoints

### `GET /api/admin/metrics?range=today|7d|30d`

Auth: Supabase session + `profiles.is_admin` check (401/403).

Returns:
- **Summary:** total calls, success rate, avg latency, total tokens in/out, total cost USD, total searches
- **By provider:** minimax/serper/github breakdown (calls, tokens, cost, avg latency)
- **By operation:** phase1_search / deep_dive_v2 / web_search / web_fetch
- **Timeline:** hourly (today) or daily (7d/30d) — calls, tokens, cost
- **Errors:** rate_limit count, timeout count, parse errors, error rate trend
- **Recent calls:** last 50 with full details

### `GET /api/admin/search-analytics?range=today|7d|30d`

Auth: same as above.

Returns:
- Searches per day, mode distribution (LEARN/BUILD/SCOUT)
- Avg repos per search, popular topics (top 10), cache hit rate
- Cost per search (join searches + api_usage_logs)

### Shared `verifyAdmin(request)` helper

Checks Supabase Auth session + `is_admin` flag, reusable across routes.

---

## 4. Dashboard UI

### Routes

- `/admin/login` — Supabase Auth email/password login
- `/admin/llm-usage` — Main dashboard (redirects to login if unauthenticated)

### Design language

Matches project style: Literata headings, Atkinson Hyperlegible body, teal (#0F766E) accent, warm off-white (#FAFAF8) background. Professional dashboard layout with full-width content area.

### Components (Recharts)

1. **MetricCards** (top row, 6 cards) — animated count-up, sparkline mini-chart, color-coded trend (green/red)
   - Total API Calls, Success Rate %, Avg Latency ms, Tokens Used, Total Cost $, Total Searches

2. **TimeRangeFilter** — Today / 7 Days / 30 Days toggle pills + auto-refresh toggle (15s)

3. **CostTimelineChart** — Stacked area chart: MiniMax cost vs Serper cost over time

4. **ProviderBreakdownChart** — Donut chart: call distribution by provider with hover tooltips

5. **OperationBarChart** — Horizontal bar: calls + avg latency by operation type

6. **ErrorRateChart** — Line chart with error rate trend, annotated rate_limit spikes

7. **SearchAnalyticsPanel** — Mode distribution pie, top topics, avg repos/search, cache hit rate

8. **RecentCallsTable** — Sortable/filterable, last 50 calls, provider badge, expandable metadata rows

### Interactive polish (beyond AI News Station)

- Cards: hover lift + subtle glow
- Charts: smooth crosshair tooltips with formatted values
- Table: expandable rows for metadata JSON
- Responsive: 2-col desktop, stacked mobile
- Auto-refresh: 15s interval with visual indicator

---

## 5. Auth Flow

1. Navigate to `/admin/login`
2. Enter email/password → Supabase Auth sign-in
3. Check `profiles.is_admin = true` → redirect to `/admin/llm-usage`
4. API routes verify session + is_admin on every request
5. Non-admin users get 403

---

## File Structure

```
lib/api-logger.ts                          — Fire-and-forget logging functions
lib/admin-auth.ts                          — verifyAdmin() helper
app/admin/login/page.tsx                   — Login page
app/admin/llm-usage/page.tsx               — Dashboard page
app/admin/llm-usage/components/            — Chart + card components
  MetricCards.tsx
  TimeRangeFilter.tsx
  CostTimelineChart.tsx
  ProviderBreakdownChart.tsx
  OperationBarChart.tsx
  ErrorRateChart.tsx
  SearchAnalyticsPanel.tsx
  RecentCallsTable.tsx
app/api/admin/metrics/route.ts             — Metrics data endpoint
app/api/admin/search-analytics/route.ts    — Search analytics endpoint
```
