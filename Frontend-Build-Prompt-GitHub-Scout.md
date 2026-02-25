# Frontend Build Prompt — GitHub Scout Web Application

**Purpose:** This document is a functional specification for a frontend development agent. It defines exactly what to build, how each component should behave, and what data contracts to follow. **Style, colors, fonts, and visual design are NOT specified here** — a separate design agent will handle those.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Zustand, Supabase JS Client

**Deployment:** Vercel

---

## Project Structure

```
github-scout/
├── app/
│   ├── layout.tsx                    # Root layout with providers
│   ├── page.tsx                      # Home page (search input)
│   ├── scout/
│   │   └── [id]/
│   │       ├── page.tsx              # Results page (Phase 1 + Phase 2)
│   │       └── loading.tsx           # Loading skeleton
│   ├── history/
│   │   └── page.tsx                  # Search history
│   └── api/
│       ├── scout/
│       │   ├── route.ts              # POST: initiate search (SSE stream)
│       │   └── [id]/
│       │       └── deep-dive/
│       │           └── route.ts      # POST: deep dive selected repos (SSE stream)
│       ├── feedback/
│       │   └── route.ts              # POST: submit feedback
│       └── search/
│           └── history/
│               └── route.ts          # GET: user's past searches
├── components/
│   ├── search/
│   │   ├── SearchInput.tsx           # Main search bar with mode detection
│   │   ├── ModeIndicator.tsx         # Shows detected mode (LEARN/BUILD/SCOUT)
│   │   ├── ModeSelector.tsx          # Manual mode override
│   │   └── ExampleQueries.tsx        # Clickable example query chips
│   ├── results/
│   │   ├── SearchMetaBar.tsx         # Mode, topic, stats summary
│   │   ├── StreamingProgress.tsx     # Real-time search progress indicators
│   │   ├── QuickScanTable.tsx        # Main results table (sortable, filterable, selectable)
│   │   ├── RepoRow.tsx              # Individual repo row with verification badges
│   │   ├── RepoExpandedView.tsx     # Expanded row detail
│   │   ├── VerificationBadge.tsx    # Verification status badge component
│   │   ├── RedditSignalBadge.tsx    # Reddit validation badge
│   │   ├── QualityTierBadge.tsx     # ★★★ quality rating
│   │   ├── ObservationsPanel.tsx    # AI-generated observations
│   │   ├── CuratedListsSection.tsx  # Awesome lists found
│   │   ├── IndustryToolsSection.tsx # Non-GitHub tools
│   │   └── DeepDiveCTA.tsx          # "Deep Dive Selected (N/5)" button
│   ├── deep-dive/
│   │   ├── DeepDiveCard.tsx         # Full analysis card per repo
│   │   ├── TechStackSection.tsx     # Languages, frameworks, deps
│   │   ├── ArchitectureSection.tsx  # Design patterns, code org
│   │   ├── AIPatternsSection.tsx    # AI/agentic pattern detection results
│   │   ├── SkillsSection.tsx        # Required skills breakdown
│   │   ├── ModeSpecificSection.tsx  # LEARN/BUILD/SCOUT specific content
│   │   ├── ConfidenceIndicator.tsx  # High/Medium/Low confidence per section
│   │   └── SummaryPanel.tsx         # Key takeaways, recommendations, gaps
│   ├── history/
│   │   ├── SearchHistoryList.tsx    # Past searches list
│   │   └── SearchHistoryCard.tsx    # Individual past search card
│   ├── feedback/
│   │   └── FeedbackWidget.tsx       # Thumbs up/down + optional comment per repo
│   └── shared/
│       ├── Header.tsx               # App header with nav
│       ├── Footer.tsx               # Footer
│       ├── LoadingSkeleton.tsx       # Shimmer loading states
│       └── ExportButton.tsx         # Export as Markdown/JSON
├── lib/
│   ├── supabase.ts                  # Supabase client init
│   ├── claude.ts                    # Claude API client with streaming
│   ├── types.ts                     # All TypeScript interfaces
│   ├── mode-detection.ts            # Client-side mode detection logic
│   ├── url-normalize.ts             # GitHub URL normalization
│   └── verification.ts             # Verification status helpers
├── stores/
│   └── scout-store.ts               # Zustand store for search state
├── hooks/
│   ├── useScoutStream.ts            # SSE hook for Phase 1
│   ├── useDeepDiveStream.ts         # SSE hook for Phase 2
│   └── useSearchHistory.ts          # History data hook
└── public/
    └── (static assets)
```

---

## TypeScript Interfaces (lib/types.ts)

These are the data contracts. All components must use these types.

```typescript
// ===== Enums =====
type ScoutMode = "LEARN" | "BUILD" | "SCOUT";
type VerificationLevel = "verified" | "inferred" | "unverified" | "stale" | "conflicting";
type FreshnessStatus = "active" | "stale" | "archived";
type RedditSignal = "validated" | "mixed" | "no_data";
type QualityTier = 1 | 2 | 3;
type FeedbackSignal = "useful" | "not_useful" | "inaccurate";

// ===== Search =====
interface ScoutConfig {
  min_stars: number;         // default: 100
  recency_months: number;    // default: 12
  reddit_validation: boolean; // default: true
  max_results: number;       // default: 25
}

interface ScoutRequest {
  query: string;
  mode?: ScoutMode;
  config?: Partial<ScoutConfig>;
}

interface SearchMeta {
  id: string;
  query: string;
  mode: ScoutMode;
  topic_extracted: string;
  searches_performed: number;
  repos_evaluated: number;
  repos_verified: number;
  created_at: string;
}

// ===== Repository =====
interface RepoVerification {
  existence: { status: "live" | "dead" | "redirect"; checked_at: string };
  stars: { value: number; level: VerificationLevel; source: string };
  last_commit: { value: string; level: VerificationLevel };
  language: { value: string; level: VerificationLevel };
  license: { value: string; level: VerificationLevel };
  freshness: { status: FreshnessStatus; level: VerificationLevel };
  community: { signal: RedditSignal; level: VerificationLevel; details?: string };
  readme_quality?: { score: number; level: VerificationLevel }; // Phase 2 only
}

interface RepoResult {
  repo_url: string;
  repo_name: string;          // "owner/repo"
  stars: number | null;
  last_commit: string | null;  // ISO date
  primary_language: string | null;
  license: string | null;
  quality_tier: QualityTier;
  verification: RepoVerification;
  reddit_signal: RedditSignal;
  summary: string;
  source_strategies: string[];
  is_selected: boolean;        // Client-side state for Phase 2 selection
}

// ===== Deep Dive =====
interface AIPatterns {
  has_ai_components: boolean;
  sdks_detected: string[];
  agent_architecture: string | null;
  skill_files: string[];
  mcp_usage: boolean;
  prompt_engineering: {
    has_system_prompts: boolean;
    has_few_shot: boolean;
    prompt_location: string | null;
  };
  confidence: "high" | "medium" | "low";
  summary: string;
}

interface DeepDiveSection {
  title: string;
  content: string;         // Markdown content
  confidence: "high" | "medium" | "low";
  source?: string;         // Where this info came from
}

interface DeepDiveResult {
  repo_url: string;
  repo_name: string;
  stars: number;
  contributors: number | null;
  license: string;
  primary_language: string;
  last_updated: string;
  what_it_does: DeepDiveSection;
  why_it_stands_out: DeepDiveSection;
  tech_stack: {
    languages: string[];
    frameworks: string[];
    infrastructure: string[];
    key_dependencies: string[];
    confidence: "high" | "medium" | "low";
  };
  architecture: DeepDiveSection;
  ai_patterns: AIPatterns;
  skills_required: {
    technical: string[];
    design: string[];
    domain: string[];
  };
  mode_specific: DeepDiveSection; // Content varies by mode
}

interface ScoutSummary {
  takeaways: string[];
  recommendations: {
    learning?: { repo: string; reason: string };
    building?: { repo: string; reason: string };
    scouting?: { insight: string };
  };
  skills_roadmap: string[];
  gaps_discovered: string[];
  ai_ecosystem_notes: string;
}

// ===== SSE Events =====
type SSEEvent =
  | { type: "mode_detected"; data: { mode: ScoutMode; topic: string; confidence: number } }
  | { type: "search_progress"; data: { strategy: string; status: "running" | "complete"; repos_found: number } }
  | { type: "repo_discovered"; data: RepoResult }
  | { type: "verification_update"; data: { repo_url: string; verification: Partial<RepoVerification> } }
  | { type: "observation"; data: { text: string } }
  | { type: "curated_list"; data: { name: string; url: string; description: string } }
  | { type: "industry_tool"; data: { name: string; description: string; url?: string } }
  | { type: "phase1_complete"; data: { total_repos: number; verified: number; unverified: number } }
  | { type: "deep_dive_start"; data: { repo_url: string; index: number; total: number } }
  | { type: "deep_dive_section"; data: { repo_url: string; section: string; content: any } }
  | { type: "deep_dive_complete"; data: DeepDiveResult }
  | { type: "summary"; data: ScoutSummary }
  | { type: "error"; data: { message: string; recoverable: boolean } };

// ===== History =====
interface SearchHistoryItem {
  id: string;
  query: string;
  mode: ScoutMode;
  repos_found: number;
  created_at: string;
  phase2_complete: boolean;
}

// ===== Feedback =====
interface FeedbackRequest {
  search_id: string;
  repo_url: string;
  signal: FeedbackSignal;
  comment?: string;
}
```

---

## Zustand Store (stores/scout-store.ts)

```typescript
interface ScoutStore {
  // Search state
  searchMeta: SearchMeta | null;
  mode: ScoutMode | null;
  isSearching: boolean;
  
  // Phase 1
  repos: RepoResult[];
  searchProgress: { strategy: string; status: string; repos_found: number }[];
  observations: string[];
  curatedLists: { name: string; url: string; description: string }[];
  industryTools: { name: string; description: string; url?: string }[];
  phase1Complete: boolean;
  
  // Phase 2
  selectedRepoUrls: string[];     // max 5
  deepDiveResults: DeepDiveResult[];
  summary: ScoutSummary | null;
  isDeepDiving: boolean;
  phase2Complete: boolean;
  
  // Actions
  setMode: (mode: ScoutMode) => void;
  addRepo: (repo: RepoResult) => void;
  updateRepoVerification: (url: string, verification: Partial<RepoVerification>) => void;
  toggleRepoSelection: (url: string) => void;
  addDeepDiveResult: (result: DeepDiveResult) => void;
  setSummary: (summary: ScoutSummary) => void;
  reset: () => void;
}
```

---

## Component Specifications

### Page: Home (`app/page.tsx`)

**Layout:**
- Centered content, vertically centered on viewport
- App name/logo at top
- Search input (large, prominent) in the center
- Mode indicator below search input (appears as user types)
- Example query chips below mode indicator
- Recent searches section at bottom (if user has history)

**Behavior:**
- Search input is autofocused on page load
- As user types (debounced 500ms), mode detection runs client-side
- ModeIndicator shows detected mode with a brief explanation
- User can click ModeSelector to override
- Pressing Enter or clicking "Scout" button initiates search
- On submit: POST to `/api/scout`, get back search ID, redirect to `/scout/[id]`
- Example queries are clickable — fill the input and auto-detect mode
- Recent searches: fetch from `/api/search/history`, show last 5

**Empty state:** First-time visitor sees example queries and a brief "How it works" section (3 steps: Search → Discover → Deep Dive)

---

### Page: Results (`app/scout/[id]/page.tsx`)

This is the main page. It handles both Phase 1 and Phase 2 in a single scrollable view.

**Layout (top to bottom):**
1. SearchMetaBar (sticky top)
2. StreamingProgress (visible during Phase 1 search)
3. QuickScanTable (appears as repos stream in)
4. ObservationsPanel (appears when Phase 1 nearing completion)
5. CuratedListsSection (appears when found)
6. IndustryToolsSection (appears when found)
7. DeepDiveCTA (sticky bottom bar, visible when Phase 1 complete)
8. DeepDiveCards (appears below table when Phase 2 starts)
9. SummaryPanel (appears when Phase 2 complete)

**Behavior:**

*Phase 1 (automatic on page load):*
- Connect to SSE stream from `/api/scout` endpoint
- As `search_progress` events arrive, update StreamingProgress chips
- As `repo_discovered` events arrive, add rows to QuickScanTable with animation
- As `verification_update` events arrive, update badges on existing rows in-place
- As `observation` events arrive, populate ObservationsPanel
- On `phase1_complete`, enable table interactivity (sort, filter, select)
- Show DeepDiveCTA sticky bar at bottom

*Between phases (user interaction):*
- User clicks checkboxes on repo rows (max 5)
- DeepDiveCTA updates: "Deep Dive Selected (3/5)"
- User clicks CTA button

*Phase 2 (on user action):*
- POST selected repos to `/api/scout/[id]/deep-dive`
- Connect to new SSE stream
- DeepDiveCards appear below the table, one per repo
- Each card streams section by section
- On all deep dives complete, SummaryPanel appears
- Page auto-scrolls to first DeepDiveCard when it starts streaming

**Error handling:**
- If SSE connection drops, show "Connection lost. Reconnecting..." toast, auto-retry 3x
- If search returns < 5 repos, show "Limited results" banner with suggestions to broaden query
- If a specific repo verification fails, show ⚠ badge on that row, don't block other results

---

### Component: SearchInput

**Props:** `onSubmit: (query: string, mode: ScoutMode) => void`

**Behavior:**
- Large text input with placeholder: "What do you want to discover? (e.g., 'AI agent frameworks for customer support')"
- Character limit: 200
- Character count shown when > 150 characters
- Submit button (icon + text) to the right of input
- Keyboard: Enter submits, Shift+Enter does nothing (single line)
- Loading state: input disabled, button shows spinner during submission
- Validation: minimum 3 characters, show inline error for too-short queries

---

### Component: ModeIndicator

**Props:** `mode: ScoutMode | null; confidence: number; onOverride: (mode: ScoutMode) => void`

**Behavior:**
- Shows when mode is detected (after user types 3+ characters)
- Displays: mode icon + mode name + brief explanation
  - LEARN: "Finding tutorials, learning resources, and beginner-friendly projects"
  - BUILD: "Finding production templates, architectures, and starter kits"
  - SCOUT: "Mapping the landscape of tools, alternatives, and opportunities"
- Confidence shown as subtle indicator (high/medium/low)
- "Change mode" link opens ModeSelector
- Animate in/out smoothly

---

### Component: StreamingProgress

**Props:** `progress: { strategy: string; status: string; repos_found: number }[]`

**Behavior:**
- Horizontal row of chips/pills, one per search strategy
- Each chip shows: strategy name + status icon
- States: ⏳ Running (animated) → ✓ Complete (N found) → ✗ Failed
- Strategy display names:
  - "high_star" → "Popular Repos"
  - "awesome_list" → "Curated Lists"
  - "topic_page" → "Topic Pages"
  - "editorial" → "Expert Roundups"
  - "architecture" → "Architecture"
  - "competitive" → "Alternatives"
  - "ai_patterns" → "AI Skills"
- Chips appear one by one as strategies start
- Collapses to summary line when Phase 1 complete: "6 strategies · 22 repos found · 20 verified"

---

### Component: QuickScanTable

**Props:** `repos: RepoResult[]; onSelectionChange: (urls: string[]) => void; phase1Complete: boolean`

**Behavior:**
- **Columns:** Select (checkbox), #, Repository, Stars, Last Active, Language, Quality, Verified, Reddit, Summary
- **Desktop:** Full table with all columns
- **Mobile:** Card view — each repo is a card with key info, expandable for details
- **Sorting:** Click column headers. Default sort: Quality Tier (desc), then Stars (desc)
- **Filtering:** Filter bar above table with:
  - Language dropdown (populated from results)
  - Quality tier pills (★★★ / ★★ / ★)
  - Verification status toggle (Verified only / All)
- **Selection:** Checkboxes on each row, max 5. Counter shown: "3 of 5 selected"
  - When 5 selected, remaining checkboxes are disabled
  - Selected rows get a subtle highlight
- **Row interaction:** Click row (not checkbox) to expand RepoExpandedView inline
- **Skeleton state:** Before repos arrive, show 5-8 skeleton rows with shimmer animation
- **Entrance animation:** New rows slide in from below as they stream in
- **Empty state:** If no repos found, show message with suggestions

---

### Component: RepoRow

**Props:** `repo: RepoResult; isSelected: boolean; onToggle: () => void; onExpand: () => void`

**Columns rendered:**
- **Select:** Checkbox
- **Repository:** `owner/repo` as link (opens GitHub in new tab), with one-line summary below in muted text
- **Stars:** Number formatted (e.g., "12.3k"), with VerificationBadge
- **Last Active:** Relative date (e.g., "2 months ago"), with FreshnessStatus color
- **Language:** Language name with colored dot (use GitHub's language colors)
- **Quality:** QualityTierBadge (★★★ / ★★ / ★)
- **Verified:** VerificationBadge (composite of all verification layers)
- **Reddit:** RedditSignalBadge
- **Summary:** One-line text, truncated with ellipsis

---

### Component: VerificationBadge

**Props:** `verification: RepoVerification`

**Behavior:**
- Shows a single composite badge based on overall verification status
- **Fully Verified** (all layers verified): Green checkmark icon
- **Partially Verified** (some layers unverified): Yellow/amber shield icon
- **Unverified** (existence not confirmed): Gray question mark icon
- Hover/click to expand tooltip showing per-layer breakdown:
  - "✓ URL verified · ✓ Stars confirmed (12,340) · 🟢 Active (updated 2 weeks ago) · ✓ Reddit validated · ⚠ License unverified"

---

### Component: DeepDiveCard

**Props:** `result: DeepDiveResult; mode: ScoutMode; isStreaming: boolean`

**Layout:**
- Card with header showing repo name, URL, key stats (stars, contributors, license, language, last updated)
- Collapsible sections for each analysis area (all expanded by default):
  1. What It Does
  2. Why It Stands Out
  3. Technology Stack (rendered as tag pills grouped by category)
  4. Architecture & Design Insights
  5. **AI & Agentic Patterns** (highlighted section — this is a key differentiator)
  6. Skills Required (rendered as tag pills grouped by category)
  7. Mode-Specific Section (LEARN: Learning Pathway / BUILD: Build Guide / SCOUT: Market Position)
- Each section has a ConfidenceIndicator in the corner
- FeedbackWidget at bottom of card

**Streaming behavior:**
- Sections appear one by one as `deep_dive_section` SSE events arrive
- Each section has a brief slide-in animation
- Sections not yet received show a subtle loading skeleton
- `isStreaming` prop controls whether skeleton placeholders are visible

---

### Component: AIPatternsSection

**Props:** `patterns: AIPatterns`

**This is a visually distinct section — it should stand out from other Deep Dive sections.**

**Layout:**
- Section header: "AI & Agentic Patterns"
- If `has_ai_components` is false: Show "No AI patterns detected" with muted styling
- If true, show:
  - **SDKs Detected:** Tag pills for each SDK (e.g., "anthropic", "langchain", "openai")
  - **Architecture Pattern:** Badge showing agent architecture type (e.g., "Multi-Agent Orchestration", "RAG Pipeline", "Tool-Calling Agent")
  - **Skill Files Found:** List of file paths (e.g., ".cursorrules", "skills/SKILL.md")
  - **MCP Usage:** Yes/No badge
  - **Prompt Engineering:** Sub-section showing what prompt patterns were found
  - **AI Summary:** AI-generated paragraph summarizing the agentic architecture
- Confidence indicator in corner

---

### Component: SummaryPanel

**Props:** `summary: ScoutSummary; mode: ScoutMode`

**Layout:**
- Full-width panel below all DeepDiveCards
- Sections:
  1. **Key Takeaways** — Numbered list of 3-5 insights
  2. **Recommended Starting Points** — Mode-aware recommendation with repo name + reason
  3. **Skills Roadmap** — Ordered list from foundational → advanced, shown as a stepped progression
  4. **Gaps Discovered** — What's missing in the ecosystem
  5. **AI Ecosystem Notes** — Summary of agentic patterns found across all analyzed repos
- ExportButton at bottom: "Export as Markdown" / "Export as JSON"

---

### Component: FeedbackWidget

**Props:** `searchId: string; repoUrl: string`

**Behavior:**
- Inline widget at bottom of each DeepDiveCard and each RepoRow (on expand)
- Three buttons: 👍 Useful / 👎 Not useful / ⚠ Inaccurate
- Clicking any button shows optional comment textarea (collapse by default)
- Submit sends POST to `/api/feedback`
- After submit, show "Thanks for feedback" and disable buttons
- State persists in localStorage to prevent re-submitting

---

### Page: History (`app/history/page.tsx`)

**Layout:**
- Page header: "Search History"
- List of SearchHistoryCards, most recent first
- Pagination or infinite scroll (if > 20)
- Empty state: "No searches yet. Start your first scout!"

**SearchHistoryCard shows:**
- Query text (large)
- Mode badge (LEARN/BUILD/SCOUT)
- Date (relative)
- Repos found count
- Phase 2 status: "Deep dive complete" or "Quick scan only"
- Click navigates to `/scout/[id]`
- Delete button (with confirmation)

---

## SSE Streaming Hooks

### useScoutStream (hooks/useScoutStream.ts)

```typescript
function useScoutStream(searchId: string): {
  isConnected: boolean;
  isComplete: boolean;
  error: string | null;
  reconnectAttempts: number;
}
```

- Connects to SSE endpoint on mount
- Parses events and dispatches to Zustand store
- Auto-reconnects up to 3 times on connection drop
- Cleans up EventSource on unmount
- Handles `phase1_complete` event by setting `isComplete = true`

### useDeepDiveStream (hooks/useDeepDiveStream.ts)

```typescript
function useDeepDiveStream(searchId: string, repoUrls: string[]): {
  isConnected: boolean;
  isComplete: boolean;
  currentRepo: string | null;
  progress: { completed: number; total: number };
  error: string | null;
}
```

- Initiates POST with repo URLs, then connects to SSE stream
- Updates DeepDiveResults in Zustand store as sections stream in
- Tracks progress (1/3, 2/3, 3/3)
- On `summary` event, sets summary in store and marks complete

---

## API Route Specifications

### POST /api/scout/route.ts

**Input:** ScoutRequest (from request body)

**Processing:**
1. Validate input (query length, mode if provided)
2. Generate search ID (UUID)
3. Create search record in Supabase
4. Construct Claude API call with:
   - System prompt: GitHub Scout skill file content
   - User message: Phase 1 prompt template filled with query + mode + config
   - Tools: `web_search_20250305`
   - Stream: true
5. Parse Claude's streaming response:
   - Extract tool_use blocks (web_search calls) → emit `search_progress` events
   - Extract text blocks → parse for repo data → emit `repo_discovered` events
   - Run verification checks on each repo → emit `verification_update` events
   - Extract observations → emit `observation` events
6. When Claude's response completes, emit `phase1_complete`
7. Save all results to Supabase

**Output:** SSE stream of events (see SSEEvent types above)

**Error handling:**
- Claude API failure → emit `error` event with `recoverable: true`, retry once
- Invalid input → return 400 with error message (not SSE)
- Rate limit exceeded → return 429 with retry-after header

### POST /api/scout/[id]/deep-dive/route.ts

**Input:** `{ repo_urls: string[] }` (max 5)

**Processing:**
1. Validate: search ID exists, repo URLs are from that search's results
2. For each repo URL (sequential, not parallel — to manage API costs):
   a. Construct Claude API call with Phase 2 prompt + web_search + web_fetch tools
   b. Stream Deep Dive sections as they're generated
   c. Parse AI patterns from response
   d. Save to Supabase
3. After all repos analyzed, generate summary
4. Emit `summary` event

**Output:** SSE stream of deep_dive events

### POST /api/feedback/route.ts

**Input:** FeedbackRequest

**Processing:** Insert into Supabase `feedback` table

**Output:** `{ success: true }`

### GET /api/search/history/route.ts

**Input:** Query params: `limit` (default 20), `offset` (default 0)

**Processing:** Query Supabase `searches` table for current user/session

**Output:** `{ searches: SearchHistoryItem[], total: number }`

---

## Supabase Setup

### Tables to Create

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Searches
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

-- Search Results (repos found)
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

-- Feedback
create table feedback (
  id uuid primary key default uuid_generate_v4(),
  search_id uuid references searches(id) on delete cascade,
  repo_url text not null,
  signal text not null check (signal in ('useful', 'not_useful', 'inaccurate')),
  comment text,
  created_at timestamptz default now()
);

-- Skill Versions (for iteration system)
create table skill_versions (
  id uuid primary key default uuid_generate_v4(),
  version text not null unique,
  skill_content text not null,
  eval_scores jsonb default '{}',
  active boolean default false,
  created_at timestamptz default now()
);

-- Indexes
create index idx_searches_user on searches(user_id);
create index idx_searches_created on searches(created_at desc);
create index idx_results_search on search_results(search_id);
create index idx_results_repo on search_results(repo_url);
create index idx_feedback_search on feedback(search_id);

-- RLS
alter table searches enable row level security;
alter table search_results enable row level security;
alter table feedback enable row level security;

-- Policies (using session ID stored in cookie)
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
```

### Environment Variables (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
ANTHROPIC_API_KEY=xxx
```

---

## Mode Detection Logic (lib/mode-detection.ts)

```typescript
const MODE_TRIGGERS: Record<ScoutMode, string[]> = {
  LEARN: [
    "learn", "teach", "tutorial", "how to", "how do", "beginner",
    "study", "understand", "skills for", "getting started",
    "explain", "introduction", "course", "education", "practice"
  ],
  BUILD: [
    "build", "create", "make", "template", "boilerplate", "scaffold",
    "stack", "implement", "architecture", "starter", "setup",
    "deploy", "production", "project structure", "tech stack"
  ],
  SCOUT: [
    "what exists", "alternatives", "compare", "comparison", "landscape",
    "trending", "overview", "tools for", "options for", "market",
    "competitors", "versus", "vs", "which is better", "what's out there"
  ]
};

interface ModeDetectionResult {
  mode: ScoutMode | null;
  confidence: number;  // 0-1
  triggers_matched: string[];
}

function detectMode(query: string): ModeDetectionResult {
  // Implementation: score each mode by number of triggers matched
  // Return highest scoring mode, or null if tied/no matches
}
```

---

## URL Normalization (lib/url-normalize.ts)

```typescript
function normalizeGitHubUrl(url: string): string {
  // Strip trailing slashes
  // Remove /tree/main, /tree/master suffixes
  // Remove www.
  // Ensure https://
  // Lowercase owner/repo
  // Return canonical form: https://github.com/owner/repo
}

function deduplicateRepos(repos: RepoResult[]): RepoResult[] {
  // Normalize all URLs
  // Keep the instance with highest verification level
  // Merge source_strategies from duplicates
}
```

---

## Key Interaction Patterns

### Pattern 1: Progressive Disclosure
- Phase 1 shows summary data in table
- Expanding a row shows more detail
- Phase 2 (Deep Dive) shows full analysis
- Each level reveals more only when the user asks for it

### Pattern 2: Streaming Confidence
- Data appears with verification badges from the start
- Badges update in-place as verification completes
- User always knows what's confirmed vs. inferred

### Pattern 3: Non-Blocking Errors
- Individual repo verification failures don't block the table
- Failed verifications show as ⚠ badges, not error screens
- Error toast for system-level failures (API down, network lost)

### Pattern 4: Sticky Navigation
- SearchMetaBar stays visible at top while scrolling
- DeepDiveCTA bar stays at bottom until Phase 2 starts
- "Back to top" button appears after scrolling past table

---

## Responsive Breakpoints

| Breakpoint | Layout Changes |
|------------|---------------|
| **Desktop (≥1024px)** | Full table view, side-by-side Deep Dive cards |
| **Tablet (768-1023px)** | Table with hidden less-important columns (Reddit, Language) |
| **Mobile (<768px)** | Card view instead of table, stacked Deep Dive cards, full-width search |

---

## Accessibility Requirements

- All interactive elements keyboard accessible
- Focus management: after Phase 1 completes, focus moves to first selectable row
- Screen reader: table uses proper `<table>` with `<th scope>`, not divs
- Verification badges have aria-labels describing the status
- Streaming progress announced via aria-live region
- Color is never the sole indicator of status (always paired with icon/text)
- Minimum contrast ratio: 4.5:1 for all text

---

## Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Time to Interactive | < 3s |
| Bundle size (JS) | < 200KB gzipped |
| SSE connection overhead | < 100ms |

---

## Notes for the Build Agent

1. **Do not implement visual design.** Use shadcn/ui defaults and Tailwind utilities for layout/spacing. A design agent will provide the color palette, typography, and visual theme separately.

2. **Streaming is the core UX.** The app should feel alive during searches. Every state change should have a smooth transition. Dead screens (blank loading) should never appear.

3. **Verification badges are trust signals.** They must be present and accurate on every data point shown to users. This is not decorative — it's functional.

4. **The AI Patterns section is the differentiator.** Give it visual prominence in Deep Dive cards. This is what makes GitHub Scout unique compared to plain GitHub search.

5. **Mobile-first for the table.** The QuickScanTable card view on mobile is more important than the desktop table. Most developer exploration happens on phones.

6. **Error states matter.** Every component needs: loading, empty, error, and populated states. SSE disconnection should be handled gracefully with auto-reconnect.

7. **Export is simple.** Markdown export = render current results as markdown string and trigger download. JSON export = serialize Zustand store to JSON file. No server-side rendering needed for export.
