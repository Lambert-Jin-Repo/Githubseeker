# GitHub Scout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-powered repository intelligence platform that discovers, verifies, and analyzes GitHub repos via MiniMax M2.5 + Brave Search with streaming results.

**Architecture:** Next.js 15 App Router with SSE streaming from API routes that call MiniMax M2.5 API with custom tool definitions (Brave Search for web search, fetch for web content). Supabase for persistence. Zustand for client state. Two-phase workflow: Phase 1 (discovery + quick scan table) and Phase 2 (deep dive analysis cards).

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Supabase, MiniMax M2.5 API (via OpenAI-compatible SDK), Brave Search API, Vitest

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `.env.local.example`, `.gitignore`

**Step 1: Create Next.js project**

Run:
```bash
npx create-next-app@latest github-scout --typescript --tailwind --eslint --app --src=no --import-alias "@/*" --use-npm
```

Move contents from `github-scout/` up to the project root if needed.

**Step 2: Install dependencies**

Run:
```bash
npm install @supabase/supabase-js zustand openai uuid
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @types/uuid
```

**Step 3: Install shadcn/ui**

Run:
```bash
npx shadcn@latest init
```

Select: New York style, Zinc base color, CSS variables yes.

Then install needed components:
```bash
npx shadcn@latest add button input badge table card checkbox tooltip skeleton tabs separator scroll-area dropdown-menu dialog toast
```

**Step 4: Create `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
MINIMAX_API_KEY=xxx
BRAVE_SEARCH_API_KEY=xxx
```

Copy to `.env.local` and fill in real values.

**Step 5: Add Vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

Create `vitest.setup.ts`:
```typescript
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` scripts:
```json
"test": "vitest",
"test:run": "vitest run"
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 project with deps"
```

---

## Task 2: Supabase Schema Migration

**Files:**
- Reference: `Frontend-Build-Prompt-GitHub-Scout.md` (SQL section)

**Step 1: Apply migration via Supabase MCP**

Use `apply_migration` to create all tables. The SQL is defined in the Frontend Build Prompt. Apply as a single migration named `initial_schema`.

SQL to apply:
```sql
create extension if not exists "uuid-ossp";

create table searches (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  query text not null,
  mode text not null check (mode in ('LEARN', 'BUILD', 'SCOUT')),
  topic_extracted text,
  config jsonb default '{}',
  phase1_complete boolean default false,
  phase2_complete boolean default false,
  observations text[] default '{}',
  created_at timestamptz default now()
);

create table search_results (
  id uuid primary key default uuid_generate_v4(),
  search_id uuid references searches(id) on delete cascade,
  repo_url text not null,
  repo_name text not null,
  stars integer,
  last_commit date,
  primary_language text,
  license text,
  quality_tier integer check (quality_tier in (1, 2, 3)),
  verification jsonb default '{}',
  reddit_signal text default 'no_data',
  summary text,
  source_strategies text[] default '{}',
  deep_dive jsonb,
  created_at timestamptz default now()
);

create table feedback (
  id uuid primary key default uuid_generate_v4(),
  search_id uuid references searches(id) on delete cascade,
  repo_url text not null,
  signal text not null check (signal in ('useful', 'not_useful', 'inaccurate')),
  comment text,
  created_at timestamptz default now()
);

create table skill_versions (
  id uuid primary key default uuid_generate_v4(),
  version text not null unique,
  skill_content text not null,
  eval_scores jsonb default '{}',
  active boolean default false,
  created_at timestamptz default now()
);

create index idx_searches_user on searches(user_id);
create index idx_searches_created on searches(created_at desc);
create index idx_results_search on search_results(search_id);
create index idx_results_repo on search_results(repo_url);
create index idx_feedback_search on feedback(search_id);

alter table searches enable row level security;
alter table search_results enable row level security;
alter table feedback enable row level security;

create policy "Users can view own searches"
  on searches for select
  using (user_id = current_setting('app.user_id', true));

create policy "Users can insert own searches"
  on searches for insert
  with check (user_id = current_setting('app.user_id', true));

create policy "Users can view own results"
  on search_results for select
  using (search_id in (
    select id from searches where user_id = current_setting('app.user_id', true)
  ));

create policy "Users can insert results"
  on search_results for insert
  with check (search_id in (
    select id from searches where user_id = current_setting('app.user_id', true)
  ));

create policy "Users can update own results"
  on search_results for update
  using (search_id in (
    select id from searches where user_id = current_setting('app.user_id', true)
  ));

create policy "Users can insert feedback"
  on feedback for insert
  with check (search_id in (
    select id from searches where user_id = current_setting('app.user_id', true)
  ));

create policy "Users can view own feedback"
  on feedback for select
  using (search_id in (
    select id from searches where user_id = current_setting('app.user_id', true)
  ));
```

**Step 2: Verify tables exist**

Use `list_tables` to confirm all 4 tables are created in the public schema.

**Step 3: Run security advisors**

Use `get_advisors` (security) to check for any issues with the RLS policies.

---

## Task 3: Core Type Definitions

**Files:**
- Create: `lib/types.ts`
- Test: `lib/__tests__/types.test.ts`

**Step 1: Write type validation test**

Create `lib/__tests__/types.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("Type contracts", () => {
  it("ScoutMode values are valid", () => {
    const modes: Array<"LEARN" | "BUILD" | "SCOUT"> = ["LEARN", "BUILD", "SCOUT"];
    expect(modes).toHaveLength(3);
  });

  it("QualityTier values are valid", () => {
    const tiers: Array<1 | 2 | 3> = [1, 2, 3];
    expect(tiers).toHaveLength(3);
  });
});
```

**Step 2: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/types.test.ts`

**Step 3: Create full types file**

Create `lib/types.ts` with ALL interfaces from the Frontend Build Prompt (Section: TypeScript Interfaces). This is the single source of truth — copy the full type definitions from `Frontend-Build-Prompt-GitHub-Scout.md` lines 96-252.

**Step 4: Commit**

```bash
git add lib/types.ts lib/__tests__/types.test.ts
git commit -m "feat: add core TypeScript type definitions"
```

---

## Task 4: Supabase Client + Session Identity

**Files:**
- Create: `lib/supabase.ts`, `lib/session.ts`
- Test: `lib/__tests__/session.test.ts`

**Step 1: Write session test**

Create `lib/__tests__/session.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { generateSessionId, isValidSessionId } from "../session";

describe("Session identity", () => {
  it("generates a valid UUID session ID", () => {
    const id = generateSessionId();
    expect(isValidSessionId(id)).toBe(true);
  });

  it("rejects invalid session IDs", () => {
    expect(isValidSessionId("")).toBe(false);
    expect(isValidSessionId("not-a-uuid")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/session.test.ts`
Expected: FAIL — module not found

**Step 3: Implement session module**

Create `lib/session.ts`:
```typescript
import { v4 as uuidv4 } from "uuid";

const SESSION_COOKIE_NAME = "github_scout_session";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function generateSessionId(): string {
  return uuidv4();
}

export function isValidSessionId(id: string): boolean {
  return UUID_REGEX.test(id);
}

export function getOrCreateSessionId(): string {
  if (typeof document === "undefined") return generateSessionId();

  const cookies = document.cookie.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));

  if (sessionCookie) {
    const id = sessionCookie.split("=")[1];
    if (isValidSessionId(id)) return id;
  }

  const newId = generateSessionId();
  document.cookie = `${SESSION_COOKIE_NAME}=${newId}; path=/; max-age=${60 * 60 * 24 * 90}; SameSite=Lax`;
  return newId;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/session.test.ts`
Expected: PASS

**Step 5: Create Supabase client**

Create `lib/supabase.ts`:
```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client (uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client (uses service role key, sets user context for RLS)
export function createServerClient(userId: string) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const client = createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: {
        "x-user-id": userId,
      },
    },
  });
  return client;
}

// Helper to set RLS context before queries
export async function withUserContext(userId: string) {
  const client = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await client.rpc("set_config", { setting: "app.user_id", value: userId });
  return client;
}
```

**Step 6: Commit**

```bash
git add lib/supabase.ts lib/session.ts lib/__tests__/session.test.ts
git commit -m "feat: add Supabase client and session identity"
```

---

## Task 5: Mode Detection Logic

**Files:**
- Create: `lib/mode-detection.ts`
- Test: `lib/__tests__/mode-detection.test.ts`

**Step 1: Write failing tests**

Create `lib/__tests__/mode-detection.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { detectMode } from "../mode-detection";

describe("detectMode", () => {
  it("detects LEARN mode from learning keywords", () => {
    const result = detectMode("how to build AI agents");
    expect(result.mode).toBe("LEARN");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("detects BUILD mode from builder keywords", () => {
    const result = detectMode("template for building a SaaS app");
    expect(result.mode).toBe("BUILD");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("detects SCOUT mode from scouting keywords", () => {
    const result = detectMode("what alternatives exist for Redis");
    expect(result.mode).toBe("SCOUT");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("returns null mode for ambiguous queries", () => {
    const result = detectMode("python library");
    expect(result.mode).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it("returns null for queries under 3 characters", () => {
    const result = detectMode("hi");
    expect(result.mode).toBeNull();
  });

  it("handles higher confidence with multiple trigger matches", () => {
    const single = detectMode("learn React");
    const multi = detectMode("learn how to study React tutorial");
    expect(multi.confidence).toBeGreaterThan(single.confidence);
  });

  it("returns matched triggers", () => {
    const result = detectMode("how to learn building AI agents");
    expect(result.triggers_matched.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/mode-detection.test.ts`
Expected: FAIL — module not found

**Step 3: Implement mode detection**

Create `lib/mode-detection.ts`:
```typescript
import type { ScoutMode } from "./types";

const MODE_TRIGGERS: Record<ScoutMode, string[]> = {
  LEARN: [
    "learn", "teach", "tutorial", "how to", "how do", "beginner",
    "study", "understand", "skills for", "getting started",
    "explain", "introduction", "course", "education", "practice",
  ],
  BUILD: [
    "build", "create", "make", "template", "boilerplate", "scaffold",
    "stack", "implement", "architecture", "starter", "setup",
    "deploy", "production", "project structure", "tech stack",
  ],
  SCOUT: [
    "what exists", "alternatives", "compare", "comparison", "landscape",
    "trending", "overview", "tools for", "options for", "market",
    "competitors", "versus", "vs", "which is better", "what's out there",
  ],
};

export interface ModeDetectionResult {
  mode: ScoutMode | null;
  confidence: number;
  triggers_matched: string[];
}

export function detectMode(query: string): ModeDetectionResult {
  if (query.length < 3) {
    return { mode: null, confidence: 0, triggers_matched: [] };
  }

  const lowerQuery = query.toLowerCase();
  const scores: Record<ScoutMode, { count: number; triggers: string[] }> = {
    LEARN: { count: 0, triggers: [] },
    BUILD: { count: 0, triggers: [] },
    SCOUT: { count: 0, triggers: [] },
  };

  for (const [mode, triggers] of Object.entries(MODE_TRIGGERS) as [ScoutMode, string[]][]) {
    for (const trigger of triggers) {
      if (lowerQuery.includes(trigger)) {
        scores[mode].count++;
        scores[mode].triggers.push(trigger);
      }
    }
  }

  const sorted = (Object.entries(scores) as [ScoutMode, { count: number; triggers: string[] }][])
    .sort((a, b) => b[1].count - a[1].count);

  const [topMode, topScore] = sorted[0];
  const [, secondScore] = sorted[1];

  if (topScore.count === 0) {
    return { mode: null, confidence: 0, triggers_matched: [] };
  }

  if (topScore.count === secondScore.count) {
    return { mode: null, confidence: 0, triggers_matched: [...topScore.triggers, ...secondScore.triggers] };
  }

  const maxPossible = MODE_TRIGGERS[topMode].length;
  const confidence = Math.min(topScore.count / Math.max(maxPossible * 0.3, 1), 1);

  return {
    mode: topMode,
    confidence: Math.round(confidence * 100) / 100,
    triggers_matched: topScore.triggers,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/mode-detection.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/mode-detection.ts lib/__tests__/mode-detection.test.ts
git commit -m "feat: add client-side mode detection logic"
```

---

## Task 6: URL Normalization + Deduplication

**Files:**
- Create: `lib/url-normalize.ts`
- Test: `lib/__tests__/url-normalize.test.ts`

**Step 1: Write failing tests**

Create `lib/__tests__/url-normalize.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { normalizeGitHubUrl, deduplicateRepos } from "../url-normalize";

describe("normalizeGitHubUrl", () => {
  it("strips trailing slashes", () => {
    expect(normalizeGitHubUrl("https://github.com/owner/repo/")).toBe("https://github.com/owner/repo");
  });

  it("removes /tree/main suffix", () => {
    expect(normalizeGitHubUrl("https://github.com/owner/repo/tree/main")).toBe("https://github.com/owner/repo");
  });

  it("removes /tree/master suffix", () => {
    expect(normalizeGitHubUrl("https://github.com/owner/repo/tree/master")).toBe("https://github.com/owner/repo");
  });

  it("removes www prefix", () => {
    expect(normalizeGitHubUrl("https://www.github.com/owner/repo")).toBe("https://github.com/owner/repo");
  });

  it("ensures https", () => {
    expect(normalizeGitHubUrl("http://github.com/owner/repo")).toBe("https://github.com/owner/repo");
  });

  it("lowercases owner/repo", () => {
    expect(normalizeGitHubUrl("https://github.com/Owner/Repo")).toBe("https://github.com/owner/repo");
  });
});

describe("deduplicateRepos", () => {
  it("removes duplicate repos by normalized URL", () => {
    const repos = [
      { repo_url: "https://github.com/owner/repo", repo_name: "owner/repo", source_strategies: ["high_star"], quality_tier: 1 as const },
      { repo_url: "https://github.com/Owner/Repo/", repo_name: "Owner/Repo", source_strategies: ["awesome_list"], quality_tier: 2 as const },
    ] as any[];

    const result = deduplicateRepos(repos);
    expect(result).toHaveLength(1);
    expect(result[0].source_strategies).toContain("high_star");
    expect(result[0].source_strategies).toContain("awesome_list");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/url-normalize.test.ts`

**Step 3: Implement**

Create `lib/url-normalize.ts`:
```typescript
import type { RepoResult } from "./types";

export function normalizeGitHubUrl(url: string): string {
  let normalized = url.trim();
  normalized = normalized.replace(/^http:/, "https:");
  normalized = normalized.replace("://www.", "://");
  normalized = normalized.replace(/\/+$/, "");
  normalized = normalized.replace(/\/tree\/(main|master).*$/, "");
  normalized = normalized.replace(/\/blob\/(main|master).*$/, "");

  const match = normalized.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)/);
  if (match) {
    return `https://github.com/${match[1].toLowerCase()}/${match[2].toLowerCase()}`;
  }
  return normalized;
}

export function deduplicateRepos(repos: RepoResult[]): RepoResult[] {
  const seen = new Map<string, RepoResult>();

  for (const repo of repos) {
    const normalized = normalizeGitHubUrl(repo.repo_url);
    const existing = seen.get(normalized);

    if (existing) {
      const mergedStrategies = [
        ...new Set([...existing.source_strategies, ...repo.source_strategies]),
      ];
      const better = repo.quality_tier < existing.quality_tier ? repo : existing;
      seen.set(normalized, { ...better, source_strategies: mergedStrategies, repo_url: normalized });
    } else {
      seen.set(normalized, { ...repo, repo_url: normalized });
    }
  }

  return Array.from(seen.values());
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/url-normalize.test.ts`

**Step 5: Commit**

```bash
git add lib/url-normalize.ts lib/__tests__/url-normalize.test.ts
git commit -m "feat: add GitHub URL normalization and deduplication"
```

---

## Task 7: Verification Helpers

**Files:**
- Create: `lib/verification.ts`
- Test: `lib/__tests__/verification.test.ts`

**Step 1: Write failing tests**

Create `lib/__tests__/verification.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { getOverallVerificationStatus, getFreshnessStatus, formatRelativeDate } from "../verification";

describe("getOverallVerificationStatus", () => {
  it("returns fully_verified when all layers are verified", () => {
    const verification = {
      existence: { status: "live" as const, checked_at: new Date().toISOString() },
      stars: { value: 1000, level: "verified" as const, source: "github" },
      last_commit: { value: "2026-02-01", level: "verified" as const },
      language: { value: "TypeScript", level: "verified" as const },
      license: { value: "MIT", level: "verified" as const },
      freshness: { status: "active" as const, level: "verified" as const },
      community: { signal: "validated" as const, level: "verified" as const },
    };
    expect(getOverallVerificationStatus(verification)).toBe("fully_verified");
  });

  it("returns partially_verified when some layers are unverified", () => {
    const verification = {
      existence: { status: "live" as const, checked_at: new Date().toISOString() },
      stars: { value: 1000, level: "verified" as const, source: "github" },
      last_commit: { value: "2026-02-01", level: "unverified" as const },
      language: { value: "TypeScript", level: "verified" as const },
      license: { value: "MIT", level: "unverified" as const },
      freshness: { status: "active" as const, level: "verified" as const },
      community: { signal: "no_data" as const, level: "unverified" as const },
    };
    expect(getOverallVerificationStatus(verification)).toBe("partially_verified");
  });
});

describe("getFreshnessStatus", () => {
  it("returns active for recent commits", () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 2);
    expect(getFreshnessStatus(recent.toISOString())).toBe("active");
  });

  it("returns stale for 6-18 month old commits", () => {
    const stale = new Date();
    stale.setMonth(stale.getMonth() - 12);
    expect(getFreshnessStatus(stale.toISOString())).toBe("stale");
  });

  it("returns archived for > 18 month old commits", () => {
    const old = new Date();
    old.setMonth(old.getMonth() - 24);
    expect(getFreshnessStatus(old.toISOString())).toBe("archived");
  });
});
```

**Step 2: Run test, verify fail, then implement**

Create `lib/verification.ts`:
```typescript
import type { RepoVerification, FreshnessStatus, VerificationLevel } from "./types";

export type OverallStatus = "fully_verified" | "partially_verified" | "unverified";

export function getOverallVerificationStatus(v: RepoVerification): OverallStatus {
  if (v.existence.status === "dead") return "unverified";

  const levels: VerificationLevel[] = [
    v.stars.level,
    v.last_commit.level,
    v.language.level,
    v.license.level,
    v.freshness.level,
  ];

  const allVerified = levels.every((l) => l === "verified");
  if (allVerified && v.existence.status === "live") return "fully_verified";

  const someVerified = levels.some((l) => l === "verified");
  if (someVerified) return "partially_verified";

  return "unverified";
}

export function getFreshnessStatus(lastCommitDate: string): FreshnessStatus {
  const commitDate = new Date(lastCommitDate);
  const now = new Date();
  const monthsAgo = (now.getTime() - commitDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

  if (monthsAgo <= 6) return "active";
  if (monthsAgo <= 18) return "stale";
  return "archived";
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function formatStarCount(stars: number): string {
  if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`;
  return stars.toString();
}
```

**Step 3: Run test to verify passes, then commit**

```bash
git add lib/verification.ts lib/__tests__/verification.test.ts
git commit -m "feat: add verification status helpers"
```

---

## Task 8: Zustand Store

**Files:**
- Create: `stores/scout-store.ts`
- Test: `stores/__tests__/scout-store.test.ts`

**Step 1: Write failing tests**

Create `stores/__tests__/scout-store.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useScoutStore } from "../scout-store";

describe("ScoutStore", () => {
  beforeEach(() => {
    useScoutStore.getState().reset();
  });

  it("starts with empty state", () => {
    const state = useScoutStore.getState();
    expect(state.repos).toEqual([]);
    expect(state.mode).toBeNull();
    expect(state.isSearching).toBe(false);
  });

  it("adds repos", () => {
    const repo = {
      repo_url: "https://github.com/test/repo",
      repo_name: "test/repo",
      stars: 100,
      last_commit: "2026-01-01",
      primary_language: "TypeScript",
      license: "MIT",
      quality_tier: 1 as const,
      verification: {} as any,
      reddit_signal: "no_data" as const,
      summary: "Test repo",
      source_strategies: ["high_star"],
      is_selected: false,
    };
    useScoutStore.getState().addRepo(repo);
    expect(useScoutStore.getState().repos).toHaveLength(1);
  });

  it("toggles repo selection with max 5 limit", () => {
    const makeRepo = (i: number) => ({
      repo_url: `https://github.com/test/repo${i}`,
      repo_name: `test/repo${i}`,
      stars: 100, last_commit: "2026-01-01", primary_language: "TS",
      license: "MIT", quality_tier: 1 as const, verification: {} as any,
      reddit_signal: "no_data" as const, summary: "", source_strategies: [],
      is_selected: false,
    });

    const store = useScoutStore.getState();
    for (let i = 0; i < 7; i++) store.addRepo(makeRepo(i));

    for (let i = 0; i < 5; i++) store.toggleRepoSelection(`https://github.com/test/repo${i}`);
    expect(useScoutStore.getState().selectedRepoUrls).toHaveLength(5);

    // 6th selection should not go through
    store.toggleRepoSelection("https://github.com/test/repo5");
    expect(useScoutStore.getState().selectedRepoUrls).toHaveLength(5);

    // Deselecting works
    store.toggleRepoSelection("https://github.com/test/repo0");
    expect(useScoutStore.getState().selectedRepoUrls).toHaveLength(4);
  });

  it("resets state", () => {
    useScoutStore.getState().setMode("LEARN");
    useScoutStore.getState().reset();
    expect(useScoutStore.getState().mode).toBeNull();
  });
});
```

**Step 2: Implement store**

Create `stores/scout-store.ts`:
```typescript
import { create } from "zustand";
import type {
  ScoutMode, SearchMeta, RepoResult, RepoVerification,
  DeepDiveResult, ScoutSummary,
} from "@/lib/types";

interface ScoutStore {
  searchMeta: SearchMeta | null;
  mode: ScoutMode | null;
  isSearching: boolean;

  repos: RepoResult[];
  searchProgress: { strategy: string; status: string; repos_found: number }[];
  observations: string[];
  curatedLists: { name: string; url: string; description: string }[];
  industryTools: { name: string; description: string; url?: string }[];
  phase1Complete: boolean;

  selectedRepoUrls: string[];
  deepDiveResults: DeepDiveResult[];
  summary: ScoutSummary | null;
  isDeepDiving: boolean;
  phase2Complete: boolean;

  setSearchMeta: (meta: SearchMeta) => void;
  setMode: (mode: ScoutMode) => void;
  setIsSearching: (v: boolean) => void;
  addRepo: (repo: RepoResult) => void;
  updateRepoVerification: (url: string, verification: Partial<RepoVerification>) => void;
  addSearchProgress: (progress: { strategy: string; status: string; repos_found: number }) => void;
  addObservation: (text: string) => void;
  addCuratedList: (list: { name: string; url: string; description: string }) => void;
  addIndustryTool: (tool: { name: string; description: string; url?: string }) => void;
  setPhase1Complete: (v: boolean) => void;
  toggleRepoSelection: (url: string) => void;
  addDeepDiveResult: (result: DeepDiveResult) => void;
  setSummary: (summary: ScoutSummary) => void;
  setIsDeepDiving: (v: boolean) => void;
  setPhase2Complete: (v: boolean) => void;
  reset: () => void;
}

const initialState = {
  searchMeta: null,
  mode: null,
  isSearching: false,
  repos: [],
  searchProgress: [],
  observations: [],
  curatedLists: [],
  industryTools: [],
  phase1Complete: false,
  selectedRepoUrls: [],
  deepDiveResults: [],
  summary: null,
  isDeepDiving: false,
  phase2Complete: false,
};

export const useScoutStore = create<ScoutStore>((set, get) => ({
  ...initialState,

  setSearchMeta: (meta) => set({ searchMeta: meta }),
  setMode: (mode) => set({ mode }),
  setIsSearching: (v) => set({ isSearching: v }),

  addRepo: (repo) => set((s) => ({ repos: [...s.repos, repo] })),

  updateRepoVerification: (url, verification) =>
    set((s) => ({
      repos: s.repos.map((r) =>
        r.repo_url === url
          ? { ...r, verification: { ...r.verification, ...verification } }
          : r
      ),
    })),

  addSearchProgress: (progress) =>
    set((s) => {
      const existing = s.searchProgress.findIndex((p) => p.strategy === progress.strategy);
      if (existing >= 0) {
        const updated = [...s.searchProgress];
        updated[existing] = progress;
        return { searchProgress: updated };
      }
      return { searchProgress: [...s.searchProgress, progress] };
    }),

  addObservation: (text) => set((s) => ({ observations: [...s.observations, text] })),
  addCuratedList: (list) => set((s) => ({ curatedLists: [...s.curatedLists, list] })),
  addIndustryTool: (tool) => set((s) => ({ industryTools: [...s.industryTools, tool] })),
  setPhase1Complete: (v) => set({ phase1Complete: v }),

  toggleRepoSelection: (url) =>
    set((s) => {
      const isSelected = s.selectedRepoUrls.includes(url);
      if (isSelected) {
        return { selectedRepoUrls: s.selectedRepoUrls.filter((u) => u !== url) };
      }
      if (s.selectedRepoUrls.length >= 5) return s;
      return { selectedRepoUrls: [...s.selectedRepoUrls, url] };
    }),

  addDeepDiveResult: (result) =>
    set((s) => ({ deepDiveResults: [...s.deepDiveResults, result] })),

  setSummary: (summary) => set({ summary }),
  setIsDeepDiving: (v) => set({ isDeepDiving: v }),
  setPhase2Complete: (v) => set({ phase2Complete: v }),
  reset: () => set(initialState),
}));
```

**Step 3: Run tests, commit**

```bash
git add stores/scout-store.ts stores/__tests__/scout-store.test.ts
git commit -m "feat: add Zustand store for search state"
```

---

## Task 9: Home Page + Search Components

**Files:**
- Create: `app/page.tsx`, `components/search/SearchInput.tsx`, `components/search/ModeIndicator.tsx`, `components/search/ModeSelector.tsx`, `components/search/ExampleQueries.tsx`

**Step 1: Create SearchInput component**

Create `components/search/SearchInput.tsx`:
- Large text input with placeholder text from spec
- 3-200 character validation
- Submit button with loading state
- Enter to submit, disabled during loading
- Character count shown when > 150

**Step 2: Create ModeIndicator component**

Create `components/search/ModeIndicator.tsx`:
- Shows detected mode icon + name + explanation
- LEARN: "Finding tutorials, learning resources, and beginner-friendly projects"
- BUILD: "Finding production templates, architectures, and starter kits"
- SCOUT: "Mapping the landscape of tools, alternatives, and opportunities"
- "Change mode" link to toggle ModeSelector
- Animate in/out

**Step 3: Create ModeSelector component**

Create `components/search/ModeSelector.tsx`:
- Three radio-style buttons for LEARN / BUILD / SCOUT
- Highlights active mode
- Calls `onOverride` callback

**Step 4: Create ExampleQueries component**

Create `components/search/ExampleQueries.tsx`:
- Clickable chip pills with example queries:
  - LEARN: "How to build AI agents with Python"
  - BUILD: "Template for Next.js SaaS with auth"
  - SCOUT: "What open source CRM tools exist"
- Clicking fills input and triggers mode detection

**Step 5: Create Home page**

Create `app/page.tsx`:
- Centered layout, search input prominent
- Integrates all search components
- On submit: POST to `/api/scout`, redirect to `/scout/[id]`
- Uses `useRouter` for navigation
- Uses `getOrCreateSessionId` for user identity

**Step 6: Commit**

```bash
git add app/page.tsx components/search/
git commit -m "feat: add home page with search input and mode detection"
```

---

## Task 10: Phase 1 API Route (POST /api/scout)

**Files:**
- Create: `app/api/scout/route.ts`, `lib/llm.ts`, `lib/brave-search.ts`

**Step 1: Create Brave Search client**

Create `lib/brave-search.ts`:
```typescript
const BRAVE_API_URL = "https://api.search.brave.com/res/v1/web/search";

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

export async function braveSearch(query: string, count: number = 10): Promise<BraveSearchResult[]> {
  const response = await fetch(
    `${BRAVE_API_URL}?q=${encodeURIComponent(query)}&count=${count}`,
    {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY!,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Brave Search API error: ${response.status}`);
  }

  const data = await response.json();
  return (data.web?.results || []).map((r: any) => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }));
}

export async function fetchWebPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "GitHubScout/1.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
  const html = await response.text();
  // Return first 50k chars to stay within context limits
  return html.slice(0, 50000);
}
```

**Step 2: Create MiniMax LLM client (OpenAI-compatible)**

Create `lib/llm.ts`:
```typescript
import OpenAI from "openai";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { braveSearch, fetchWebPage } from "./brave-search";

const client = new OpenAI({
  apiKey: process.env.MINIMAX_API_KEY!,
  baseURL: "https://api.minimax.chat/v1",
});

// Tool definitions for MiniMax to call
const SCOUT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for information. Use for discovering GitHub repos, checking Reddit, finding articles.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          count: { type: "number", description: "Number of results (default 10)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_fetch",
      description: "Fetch the content of a web page. Use for verifying GitHub repos exist and extracting metadata.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to fetch" },
        },
        required: ["url"],
      },
    },
  },
];

// Execute tool calls by routing to real implementations
async function executeToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "web_search": {
      const results = await braveSearch(
        args.query as string,
        (args.count as number) || 10
      );
      return JSON.stringify(results);
    }
    case "web_fetch": {
      const content = await fetchWebPage(args.url as string);
      return content;
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export interface LLMCallOptions {
  systemPrompt: string;
  userMessage: string;
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
  onToolResult?: (toolName: string, result: string) => void;
  maxToolRounds?: number;
}

// Agentic loop: call LLM → execute tools → feed results back → repeat
export async function callLLMWithTools(options: LLMCallOptions): Promise<string> {
  const { systemPrompt, userMessage, onToolCall, onToolResult, maxToolRounds = 10 } = options;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  for (let round = 0; round < maxToolRounds; round++) {
    const response = await client.chat.completions.create({
      model: "MiniMax-M2.5",
      max_tokens: 16384,
      messages,
      tools: SCOUT_TOOLS,
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    const message = choice.message;
    messages.push(message);

    // If no tool calls, we're done — return the text response
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content || "";
    }

    // Execute all tool calls and feed results back
    for (const toolCall of message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      onToolCall?.(toolCall.function.name, args);

      const result = await executeToolCall(toolCall.function.name, args);
      onToolResult?.(toolCall.function.name, result);

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }
  }

  // If we hit max rounds, return whatever we have
  const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
  return (lastAssistant as any)?.content || "";
}

export { client, SCOUT_TOOLS };
```

**Step 3: Create the API route**

Create `app/api/scout/route.ts`:
- Accepts `ScoutRequest` JSON body
- Validates query (3-200 chars)
- Auto-detects mode if not provided (server-side confirmation)
- Generates search UUID, creates `searches` row in Supabase
- Constructs Phase 1 prompt from PRD template (lines 411-436)
- Calls `callLLMWithTools` with tool callbacks that emit SSE events:
  - `onToolCall("web_search", ...)` → emit `search_progress` event
  - `onToolResult("web_search", ...)` → parse results, emit `repo_discovered` events
  - `onToolCall("web_fetch", ...)` → emit `verification_update` events
- Parses final response: extracts observations, quality tiers
- On completion: saves results to `search_results` table, emits `phase1_complete`
- Error handling: catch API errors, emit `error` SSE event

SSE format:
```
event: mode_detected\ndata: {"mode":"BUILD","topic":"AI agent frameworks","confidence":0.92}\n\n
event: search_progress\ndata: {"strategy":"high_star","status":"complete","repos_found":8}\n\n
event: repo_discovered\ndata: {...repo JSON...}\n\n
event: phase1_complete\ndata: {"total_repos":22,"verified":20,"unverified":2}\n\n
```

**Step 4: Test manually**

Run: `npm run dev`
Test with curl:
```bash
curl -N -X POST http://localhost:3000/api/scout \
  -H "Content-Type: application/json" \
  -d '{"query":"AI agent frameworks","mode":"BUILD"}'
```
Expected: SSE events streaming back.

**Step 5: Commit**

```bash
git add app/api/scout/route.ts lib/llm.ts lib/brave-search.ts
git commit -m "feat: add Phase 1 search API with MiniMax M2.5 + Brave Search"
```

---

## Task 11: SSE Hook (useScoutStream)

**Files:**
- Create: `hooks/useScoutStream.ts`

**Step 1: Implement the hook**

Create `hooks/useScoutStream.ts`:
```typescript
import { useEffect, useRef, useState } from "react";
import { useScoutStore } from "@/stores/scout-store";
import type { SSEEvent } from "@/lib/types";

export function useScoutStream(searchId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const store = useScoutStore();

  useEffect(() => {
    if (!searchId) return;

    const connect = () => {
      const es = new EventSource(`/api/scout?id=${searchId}`);
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        setError(null);
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

      es.addEventListener("phase1_complete", (e) => {
        setIsComplete(true);
        store.setPhase1Complete(true);
        store.setIsSearching(false);
        es.close();
      });

      es.addEventListener("error", (e) => {
        // SSE error event (different from custom "error" event)
        if (reconnectAttempts < 3) {
          setReconnectAttempts((prev) => prev + 1);
          es.close();
          setTimeout(connect, 1000 * (reconnectAttempts + 1));
        } else {
          setError("Connection lost. Please refresh the page.");
          setIsConnected(false);
        }
      });
    };

    connect();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [searchId]);

  return { isConnected, isComplete, error, reconnectAttempts };
}
```

**Step 2: Commit**

```bash
git add hooks/useScoutStream.ts
git commit -m "feat: add SSE streaming hook for Phase 1"
```

---

## Task 12: Results Page + Table Components

**Files:**
- Create: `app/scout/[id]/page.tsx`, `app/scout/[id]/loading.tsx`
- Create: `components/results/SearchMetaBar.tsx`, `components/results/StreamingProgress.tsx`, `components/results/QuickScanTable.tsx`, `components/results/RepoRow.tsx`, `components/results/RepoExpandedView.tsx`
- Create: `components/results/VerificationBadge.tsx`, `components/results/QualityTierBadge.tsx`, `components/results/RedditSignalBadge.tsx`
- Create: `components/results/ObservationsPanel.tsx`, `components/results/CuratedListsSection.tsx`, `components/results/IndustryToolsSection.tsx`, `components/results/DeepDiveCTA.tsx`

**Step 1: Create badge components**

`VerificationBadge.tsx` — composite badge (green check / yellow shield / gray question mark) with hover tooltip showing per-layer breakdown.

`QualityTierBadge.tsx` — renders ★★★ / ★★ / ★ based on `quality_tier` prop.

`RedditSignalBadge.tsx` — renders "validated" (green) / "mixed" (yellow) / "no data" (gray).

**Step 2: Create SearchMetaBar**

`SearchMetaBar.tsx` — sticky top bar showing mode badge, topic, stats (repos found, verified count).

**Step 3: Create StreamingProgress**

`StreamingProgress.tsx` — horizontal row of chips. Each shows strategy display name + status icon (spinner/check/X). Collapses to summary line when phase1 complete.

Strategy display names mapping:
- "high_star" → "Popular Repos"
- "awesome_list" → "Curated Lists"
- "topic_page" → "Topic Pages"
- "editorial" → "Expert Roundups"
- "architecture" → "Architecture"
- "competitive" → "Alternatives"
- "ai_patterns" → "AI Skills"

**Step 4: Create RepoRow + QuickScanTable**

`RepoRow.tsx` — single row: checkbox, repo name (linked), stars, last active, language (colored dot), quality tier, verification badge, reddit signal, summary (truncated).

`RepoExpandedView.tsx` — expanded inline view with extended description, tech stack preview, source strategies.

`QuickScanTable.tsx` — full table with sorting (by stars, last active, quality tier), filtering (language dropdown, quality pills, verified toggle), and checkbox selection (max 5). Skeleton rows before data arrives. Card view on mobile.

**Step 5: Create supplementary sections**

`ObservationsPanel.tsx` — 2-3 AI-generated sentences about patterns.

`CuratedListsSection.tsx` — list of awesome lists found.

`IndustryToolsSection.tsx` — non-GitHub tools relevant to the topic.

`DeepDiveCTA.tsx` — sticky bottom bar: "Deep Dive Selected (N/5)" button. Enabled when phase1 complete + at least 1 repo selected.

**Step 6: Create Results page**

`app/scout/[id]/page.tsx` — assembles all components. Connects `useScoutStream` hook. Reads from Zustand store. Handles Phase 1 streaming → table interactivity → Phase 2 trigger.

`app/scout/[id]/loading.tsx` — skeleton loading state.

**Step 7: Test end-to-end**

Run: `npm run dev`
Navigate to home page, enter a query, submit. Verify:
- SSE events stream in
- Table populates with repos
- Badges render correctly
- Sorting/filtering works
- Checkbox selection works (max 5)

**Step 8: Commit**

```bash
git add app/scout/ components/results/
git commit -m "feat: add results page with streaming table and badges"
```

---

## Task 13: Phase 2 API Route (Deep Dive)

**Files:**
- Create: `app/api/scout/[id]/deep-dive/route.ts`

**Step 1: Implement the route**

`app/api/scout/[id]/deep-dive/route.ts`:
- Accept `{ repo_urls: string[] }` (validate: max 5, must belong to search)
- For each repo URL **sequentially**:
  - Construct Phase 2 prompt from PRD template (lines 439-452)
  - Call `callLLMWithTools` (MiniMax M2.5) with `web_search` + `web_fetch` custom tools
  - Parse response into `DeepDiveResult` sections
  - Extract AI patterns (check for: anthropic, openai, langchain, llamaindex, cursor rules, MCP, etc.)
  - Emit `deep_dive_start`, `deep_dive_section`, `deep_dive_complete` SSE events
  - Save `deep_dive` JSONB to `search_results` row
- After all repos: generate summary prompt, emit `summary` event
- Update `searches.phase2_complete = true`

**Step 2: Test with curl**

```bash
curl -N -X POST http://localhost:3000/api/scout/SEARCH_ID/deep-dive \
  -H "Content-Type: application/json" \
  -d '{"repo_urls":["https://github.com/langchain-ai/langchain"]}'
```

**Step 3: Commit**

```bash
git add app/api/scout/\[id\]/deep-dive/
git commit -m "feat: add Phase 2 deep dive API route"
```

---

## Task 14: Deep Dive SSE Hook

**Files:**
- Create: `hooks/useDeepDiveStream.ts`

**Step 1: Implement**

`hooks/useDeepDiveStream.ts`:
- POST selected repo URLs to `/api/scout/[id]/deep-dive`
- Connect to SSE response stream
- Parse `deep_dive_start`, `deep_dive_section`, `deep_dive_complete`, `summary` events
- Update Zustand store: `addDeepDiveResult`, `setSummary`
- Track progress: `{ completed: number; total: number }`
- Handle errors with reconnect

**Step 2: Commit**

```bash
git add hooks/useDeepDiveStream.ts
git commit -m "feat: add SSE hook for Phase 2 deep dive"
```

---

## Task 15: Deep Dive Card Components

**Files:**
- Create: `components/deep-dive/DeepDiveCard.tsx`, `components/deep-dive/TechStackSection.tsx`, `components/deep-dive/ArchitectureSection.tsx`, `components/deep-dive/AIPatternsSection.tsx`, `components/deep-dive/SkillsSection.tsx`, `components/deep-dive/ModeSpecificSection.tsx`, `components/deep-dive/ConfidenceIndicator.tsx`, `components/deep-dive/SummaryPanel.tsx`

**Step 1: Create ConfidenceIndicator**

Small badge: High (green) / Medium (yellow) / Low (gray). Used in the corner of each Deep Dive section.

**Step 2: Create TechStackSection**

Tag pills grouped by category: Languages, Frameworks, Infrastructure, Key Dependencies. Each pill is a shadcn Badge component.

**Step 3: Create ArchitectureSection**

Renders markdown content from `DeepDiveSection`. Shows confidence indicator.

**Step 4: Create AIPatternsSection (KEY DIFFERENTIATOR)**

**This must be visually distinct.** Different background color or border treatment.

Layout when `has_ai_components` is true:
- SDKs Detected: tag pills (e.g., "anthropic", "langchain")
- Architecture Pattern: prominent badge (e.g., "Multi-Agent Orchestration")
- Skill Files Found: list of file paths
- MCP Usage: Yes/No badge
- Prompt Engineering: sub-section
- AI Summary: paragraph

When false: "No AI patterns detected" with muted styling.

**Step 5: Create SkillsSection**

Tag pills in three groups: Technical, Design, Domain.

**Step 6: Create ModeSpecificSection**

Renders different content based on mode:
- LEARN: Learning Pathway, Prerequisites, Start Here Files, Practice Ideas
- BUILD: Build Guide, Reusable Components, Starter Approach, Pitfalls
- SCOUT: Market Position, Target Audience, Competitive Advantage, Gaps

**Step 7: Create DeepDiveCard**

Full card assembling all sections. Header with repo stats. Collapsible sections (all expanded by default). Streaming: sections appear one by one with slide-in animation. Skeleton placeholders for unreceived sections.

**Step 8: Create SummaryPanel**

Full-width panel: Key Takeaways (numbered), Recommendations (mode-aware), Skills Roadmap (stepped progression), Gaps Discovered, AI Ecosystem Notes.

**Step 9: Wire into Results page**

Update `app/scout/[id]/page.tsx`:
- After DeepDiveCTA click: trigger `useDeepDiveStream`
- Render `DeepDiveCard` components below table
- Render `SummaryPanel` when phase2 complete
- Auto-scroll to first card when streaming starts

**Step 10: Commit**

```bash
git add components/deep-dive/ app/scout/
git commit -m "feat: add deep dive cards with AI pattern analysis"
```

---

## Task 16: Feedback System

**Files:**
- Create: `app/api/feedback/route.ts`, `components/feedback/FeedbackWidget.tsx`

**Step 1: Create feedback API route**

`app/api/feedback/route.ts`:
- Accept `FeedbackRequest` body
- Validate `signal` is one of: "useful", "not_useful", "inaccurate"
- Insert into Supabase `feedback` table
- Return `{ success: true }`

**Step 2: Create FeedbackWidget**

Three buttons: Useful / Not Useful / Inaccurate. Optional comment textarea (hidden by default, shown on click). POST to `/api/feedback` on submit. Persist submission state in `localStorage` to prevent re-submitting. Show "Thanks for feedback" after submit.

**Step 3: Add to DeepDiveCard and RepoExpandedView**

Place `FeedbackWidget` at the bottom of each `DeepDiveCard` and inside `RepoExpandedView`.

**Step 4: Commit**

```bash
git add app/api/feedback/ components/feedback/
git commit -m "feat: add feedback widget and API route"
```

---

## Task 17: Search History

**Files:**
- Create: `app/api/search/history/route.ts`, `app/history/page.tsx`, `components/history/SearchHistoryList.tsx`, `components/history/SearchHistoryCard.tsx`, `hooks/useSearchHistory.ts`

**Step 1: Create history API route**

`app/api/search/history/route.ts`:
- GET with query params: `limit` (default 20), `offset` (default 0)
- Query Supabase `searches` table for current session user
- Return `{ searches: SearchHistoryItem[], total: number }`

**Step 2: Create useSearchHistory hook**

Fetches from `/api/search/history`, returns `{ searches, isLoading, error }`.

**Step 3: Create history components**

`SearchHistoryCard.tsx`: query text, mode badge, relative date, repos found count, phase2 status. Click navigates to `/scout/[id]`. Delete with confirmation dialog.

`SearchHistoryList.tsx`: list of cards, most recent first. Empty state: "No searches yet."

**Step 4: Create history page**

`app/history/page.tsx`: header + `SearchHistoryList`. Uses `useSearchHistory` hook.

**Step 5: Commit**

```bash
git add app/api/search/ app/history/ components/history/ hooks/useSearchHistory.ts
git commit -m "feat: add search history page"
```

---

## Task 18: Export Functionality

**Files:**
- Create: `components/shared/ExportButton.tsx`

**Step 1: Implement ExportButton**

Client-side only. Two options: "Export as Markdown" / "Export as JSON".

- **Markdown export:** Serialize current search results + deep dive results as formatted markdown. Trigger browser download via Blob + URL.createObjectURL.
- **JSON export:** Serialize Zustand store state to JSON. Trigger download.

**Step 2: Add to SummaryPanel**

Place `ExportButton` at the bottom of `SummaryPanel`.

**Step 3: Commit**

```bash
git add components/shared/ExportButton.tsx
git commit -m "feat: add markdown and JSON export"
```

---

## Task 19: Shared Layout + Navigation

**Files:**
- Create: `components/shared/Header.tsx`, `components/shared/Footer.tsx`
- Modify: `app/layout.tsx`

**Step 1: Create Header**

App name/logo, navigation links: Home, History. Minimal, functional.

**Step 2: Create Footer**

Simple footer with app name and credits.

**Step 3: Update root layout**

`app/layout.tsx`: wrap children with Header + Footer. Add Toaster for toast notifications. Set up metadata (title, description).

**Step 4: Commit**

```bash
git add components/shared/ app/layout.tsx
git commit -m "feat: add shared layout with header and footer"
```

---

## Task 20: Loading States + Error Handling

**Files:**
- Create: `components/shared/LoadingSkeleton.tsx`
- Modify: multiple components to add error/empty states

**Step 1: Create LoadingSkeleton**

Reusable shimmer skeleton component using shadcn Skeleton. Variants: row, card, text block.

**Step 2: Add states to all components**

For each major component, ensure 4 states exist:
- **Loading:** skeleton/shimmer
- **Empty:** helpful message
- **Error:** error message with retry action
- **Populated:** normal render

Key components to update:
- `QuickScanTable`: skeleton rows (5-8) before data, "No repos found" empty state
- `DeepDiveCard`: section-by-section skeletons during streaming
- `SearchHistoryList`: "No searches yet" empty state
- `StreamingProgress`: spinner states per strategy

**Step 3: Add SSE reconnection toast**

In `useScoutStream` and `useDeepDiveStream`: on disconnect, show toast "Connection lost. Reconnecting..." with auto-dismiss on reconnect.

**Step 4: Commit**

```bash
git add components/shared/LoadingSkeleton.tsx
git commit -m "feat: add loading skeletons and error states"
```

---

## Task 21: Responsive Design

**Files:**
- Modify: `components/results/QuickScanTable.tsx`, `components/deep-dive/DeepDiveCard.tsx`, `app/page.tsx`

**Step 1: Mobile table → cards**

In `QuickScanTable.tsx`:
- Desktop (>=1024px): full table
- Tablet (768-1023px): table with hidden Language and Reddit columns
- Mobile (<768px): card view — each repo as a card with key info

Use Tailwind responsive classes: `hidden lg:table-cell`, etc.

**Step 2: Mobile search**

On mobile, search input takes full width. Example queries wrap.

**Step 3: Mobile deep dive**

Cards stack vertically, full width. Collapsible sections save space.

**Step 4: Test at all breakpoints**

Open dev tools, test at 375px (mobile), 768px (tablet), 1280px (desktop).

**Step 5: Commit**

```bash
git commit -am "feat: add responsive design for mobile and tablet"
```

---

## Task 22: Accessibility

**Files:**
- Modify: multiple components

**Step 1: Table accessibility**

`QuickScanTable`: use proper `<table>`, `<thead>`, `<th scope="col">`, `<tbody>`. Not divs.

**Step 2: Badge aria-labels**

All verification badges get `aria-label` describing the full status text.

**Step 3: Streaming announcements**

Add `aria-live="polite"` region for streaming progress updates.

**Step 4: Keyboard navigation**

Ensure all interactive elements (checkboxes, buttons, expandable rows, mode selector) are keyboard accessible. Tab order follows visual order.

**Step 5: Focus management**

After Phase 1 completes, move focus to the first selectable row (not disruptive — use `aria-live` instead of forced focus if more appropriate).

**Step 6: Color + text**

Ensure all status indicators use both color AND icon/text. Check contrast ratios >= 4.5:1.

**Step 7: Commit**

```bash
git commit -am "feat: add accessibility improvements"
```

---

## Task 23: Final Integration Test

**Step 1: Full end-to-end manual test**

1. Open home page → type query → mode auto-detects
2. Submit → redirects to results page
3. SSE streams: progress chips appear, repos populate table
4. Phase 1 completes → table is sortable, filterable
5. Select 2-3 repos → click Deep Dive
6. Deep Dive cards stream in section by section
7. AI Patterns section renders correctly
8. Summary panel appears
9. Export as Markdown → download works
10. Navigate to History → search appears
11. Click history item → results page loads
12. Test on mobile viewport

**Step 2: Fix any issues found**

**Step 3: Final commit**

```bash
git commit -am "fix: integration test fixes"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|--------------|
| 1 | Project scaffold | None |
| 2 | Supabase schema | None |
| 3 | Type definitions | Task 1 |
| 4 | Supabase client + session | Tasks 1, 2 |
| 5 | Mode detection | Task 3 |
| 6 | URL normalization | Task 3 |
| 7 | Verification helpers | Task 3 |
| 8 | Zustand store | Task 3 |
| 9 | Home page + search components | Tasks 5, 8 |
| 10 | Phase 1 API route | Tasks 4, 6, 7 |
| 11 | SSE hook (Phase 1) | Tasks 8, 10 |
| 12 | Results page + table | Tasks 7, 8, 11 |
| 13 | Phase 2 API route | Task 10 |
| 14 | Deep Dive SSE hook | Tasks 8, 13 |
| 15 | Deep Dive card components | Task 14 |
| 16 | Feedback system | Task 4 |
| 17 | Search history | Task 4 |
| 18 | Export | Task 15 |
| 19 | Shared layout | Task 1 |
| 20 | Loading + error states | Tasks 12, 15 |
| 21 | Responsive design | Tasks 12, 15 |
| 22 | Accessibility | Tasks 12, 15 |
| 23 | Integration test | All |
