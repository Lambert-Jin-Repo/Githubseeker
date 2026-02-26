# Deep Dive Analysis Page — Design Document

**Date:** 2026-02-26
**Status:** Draft

---

## Problem Statement

1. Users can re-click "Deep Dive" and restart analysis, wasting LLM calls and forcing a redundant wait
2. Deep dive results are cramped below the search table — no dedicated space for comprehensive analysis
3. Current analysis sections are shallow (2-3 sentences each) with single `source` strings — not verifiable

## Goals

- Dedicated route page for deep dive results with back navigation
- Comprehensive, detailed analysis (12 sections per repo) with inline source links
- Maximize MiniMax API usage — no cost constraints, prioritize depth and quality
- Idempotent: once analyzed, results load instantly from DB with no re-trigger option
- Progressive reveal UX: repos fill in as analysis completes

---

## Architecture

### Route: `/scout/[id]/deep-dive`

**New file:** `app/scout/[id]/deep-dive/page.tsx`

**Navigation flow:**
1. User selects repos on search results page, clicks "Deep Dive"
2. Selected repo URLs stored in Zustand before navigation
3. `router.push(/scout/${searchId}/deep-dive)` navigates to new page
4. Page checks Zustand for selected URLs; if empty (direct URL access / refresh), loads from Supabase
5. Back button at top-left returns to `/scout/[id]` (search results preserved in store + DB)
6. If deep dive results already exist in DB, render them instantly — no re-analysis
7. Button on search results page changes to "View Deep Dive" (not "Analyze") when results exist

---

## Page Layout

```
┌──────────┬──────────────────────────────────────────────────────┐
│ ← Back   │        GitHub Scout — Deep Dive Report              │
├──────────┤        Query: "AI coding agents"                    │
│          ├──────────────────────────────────────────────────────┤
│ SIDEBAR  │                                                      │
│ (sticky) │  EXECUTIVE SUMMARY                                   │
│          │  Key takeaways, top recommendation, skills roadmap   │
│ Overview │                                                      │
│ Compare  │  COMPARATIVE MATRIX                                  │
│ ──────── │  Side-by-side table of all repos                     │
│ repo-1   │                                                      │
│ repo-2   │  REPO 1: owner/repo-name ★ 12.4k                    │
│ repo-3   │  Full expanded analysis (12 sections, all open)      │
│ ──────── │                                                      │
│ Gaps     │  REPO 2: owner/repo-name ★ 3.2k                     │
│          │  Full expanded analysis...                           │
│          │                                                      │
│          │  ECOSYSTEM GAPS & OPPORTUNITIES                      │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

### Sidebar Behavior
- **Desktop (lg+):** Sticky left sidebar (~200px) with anchor links to each section
- Active section highlighted as user scrolls (IntersectionObserver)
- **Mobile:** Collapses to a floating dropdown/pill at top of page

### Loading State (Progressive Reveal)
- Page renders immediately with skeleton placeholders for each repo
- As each repo's analysis completes, its section fills in with a slide-up animation
- Executive summary and comparative matrix render last (after all repos complete)
- Users can read completed repo sections while others are still loading

---

## Analysis Sections (12 Per Repo)

Each section includes:
- **Confidence badge:** High (emerald) / Medium (amber) / Low (gray)
- **Inline source links:** Each claim backed by `[source label](url)` — clickable GitHub file links, search result URLs
- **Content fully expanded by default** — this is a report page, not a summary card

| # | Section | Content | Primary Data Sources |
|---|---------|---------|---------------------|
| 1 | **Overview** | 3-5 sentence description, key value proposition, founding context, primary use case, notable sponsors/backers | README, GitHub About section, repo page |
| 2 | **Why It Stands Out** | Competitive differentiation vs alternatives, unique selling points, what this repo does that others don't | Web search for comparisons, README |
| 3 | **Tech Stack** | Languages, frameworks, infrastructure, dependencies — **with version numbers** and links to each dependency's repo/docs page | package.json, requirements.txt, go.mod, Cargo.toml |
| 4 | **Architecture** | Multi-paragraph architecture breakdown: directory structure overview, design patterns (MVC, event-driven, microservices), data flow, key abstractions | Code structure, README architecture section |
| 5 | **Code Quality** | Test framework presence & type, CI/CD setup (GitHub Actions, CircleCI, etc.), linting/formatting config, TypeScript strictness, code coverage mentions, build system | .github/workflows/, .eslintrc, tsconfig.json, jest.config |
| 6 | **Community Health** | Open vs closed issues ratio, PR merge cadence, contributor count & distribution (bus factor), last commit recency, CONTRIBUTING.md presence, responsiveness signals | GitHub repo page, Insights data |
| 7 | **Documentation Quality** | README completeness (sections present), docs/ directory contents, API documentation (JSDoc, Swagger, etc.), examples directory, CHANGELOG presence, tutorial availability | README structure, docs/, examples/ |
| 8 | **Security Posture** | SECURITY.md presence, dependency vulnerability mentions, authentication patterns, environment variable handling (.env.example), license implications for commercial use, known CVEs | SECURITY.md, .env.example, license file |
| 9 | **AI Patterns** | SDKs detected, agent architecture classification, skill/prompt files, MCP usage, model provider diversity, fine-tuning indicators, embedding/vector DB usage, RAG pipeline detection, prompt engineering patterns (system prompts, few-shot, chain-of-thought) | Dependency files, source code patterns, config files |
| 10 | **Skills Required** | Technical skills (languages, frameworks, tools), design skills (API design, system architecture, UI/UX), domain skills (ML, NLP, DevOps) — color-coded badges | Cross-section analysis |
| 11 | **Getting Started** | Prerequisites, installation steps (copy-pasteable commands), first-run experience, environment setup, common pitfalls and troubleshooting | README, CONTRIBUTING.md, docs/getting-started |
| 12 | **Mode-Specific Insights** | LEARN mode: learning path, difficulty curve, prerequisite knowledge. BUILD mode: fork-readiness, extensibility, integration points. SCOUT mode: market position, competitive landscape, adoption trajectory | Cross-section analysis + web search |

---

## Executive Summary (Top of Page)

Replaces the current `SummaryPanel` component. Generated after all per-repo analyses complete.

**Content blocks:**
1. **Key Takeaways** — 3-5 bullet points on the ecosystem landscape, trends, and notable patterns across all repos
2. **Top Recommendation** — Mode-aware: best repo for the user's goal (learn/build/scout) with 2-3 sentence rationale and direct link
3. **Skills Roadmap** — Visual sequential pathway with concrete technologies: "Start: TypeScript basics → Next: React patterns → Then: Agent architecture → Advanced: Multi-agent orchestration"
4. **AI Ecosystem Notes** — Cross-repo AI/agent pattern summary with trend observations

## Comparative Matrix

Data table comparing all selected repos at a glance:

| Dimension | Repo 1 | Repo 2 | Repo 3 |
|-----------|--------|--------|--------|
| Stars | — | — | — |
| Primary Language | — | — | — |
| License | — | — | — |
| Last Updated | — | — | — |
| Architecture Pattern | — | — | — |
| Test Framework | — | — | — |
| CI/CD Platform | — | — | — |
| Documentation | High/Med/Low | — | — |
| Community Health | Active/Moderate/Stale | — | — |
| AI Components | Yes/No | — | — |

Each cell links to the relevant detailed section in the repo's analysis below.

## Ecosystem Gaps (Bottom of Page)

- Gaps and missing capabilities across the analyzed repos
- Contribution opportunities
- Trend observations and predictions
- Market whitespace (SCOUT mode)

---

## LLM Strategy: Maximum Parallelism

**No cost constraints on MiniMax API usage.** Prioritize analysis depth and speed.

### Phase A: Parallel Data Fetching (Node.js, ~2-3s)

Fetch all raw data for ALL repos simultaneously using `fetchWebPage` and `searchWeb` from `lib/web-search.ts`. No LLM involved — pure HTTP requests.

Per repo, fetch in parallel:
1. GitHub repo page → stars, about, language, license, last updated
2. README.md (raw) → project description, architecture docs, getting started
3. File tree listing (repo `/tree/main` page) → directory structure, presence of docs/, .github/, SECURITY.md, CONTRIBUTING.md, examples/
4. Primary dependency file (package.json / requirements.txt / go.mod / Cargo.toml) → deps with versions
5. CI/CD config (`.github/workflows/` listing or specific workflow file) → CI setup
6. Web search: "{repo_name} review OR comparison OR alternatives" → community context

For 3 repos: 18 parallel fetches, all complete in ~2-3s.

**Output:** A `RawRepoData` object per repo containing all fetched content.

### Phase B: Parallel LLM Analysis (~12-15s)

Each repo's raw data is split across **4 specialized parallel LLM calls**, each with a focused prompt and all relevant raw data pre-loaded (no tool calls needed):

```
Repo 1 ─┬─ LLM Call A: Overview + Why It Stands Out + Tech Stack (with versions) + Architecture
         ├─ LLM Call B: Code Quality + Community Health + Documentation Quality + Security Posture
         ├─ LLM Call C: AI Patterns (deep) + Skills Required + Mode-Specific Insights
         └─ LLM Call D: Getting Started + Verification pass (cross-check claims against raw data)

Repo 2 ─┬─ (same 4 calls)
         ...

Repo 3 ─┬─ (same 4 calls)
         ...
```

For 3 repos: **12 parallel LLM calls**, all fire simultaneously.
Each call receives the full raw data but only analyzes its assigned sections.
Each call returns structured JSON with `sources` arrays for inline linking.

**Wall-clock time: ~12-15s** (limited by the slowest single LLM call, not the count).

### Phase C: Summary + Comparative Matrix (~12s)

One final LLM call with ALL repo analysis results as context:
- Generates executive summary (takeaways, recommendation, skills roadmap)
- Generates comparative matrix data
- Generates ecosystem gaps analysis
- Cross-references repos for comparative insights

**Total wall-clock time: ~2s (fetch) + ~15s (analysis) + ~12s (summary) = ~29s**

### Background Precompute

Same as current architecture: after Phase 1 search completes, fire-and-forget deep dive precompute for all discovered repos. When user clicks "Deep Dive," results are already in DB for instant page load.

The precompute also uses the new parallel strategy, so background analysis completes faster.

---

## Enhanced Type System

### New Types

```typescript
// Replaces single `source?: string` with array of verifiable links
interface SourceLink {
  label: string;   // e.g., "package.json", "README.md", "GitHub Actions"
  url: string;     // e.g., "https://github.com/owner/repo/blob/main/package.json"
}

// Enhanced section with multiple source links
interface EnhancedSection {
  title: string;
  content: string;
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

// New section types
interface CodeQuality {
  has_tests: boolean;
  test_framework: string | null;
  has_ci: boolean;
  ci_platform: string | null;
  ci_config_url: string | null;
  has_linting: boolean;
  linter: string | null;
  typescript_strict: boolean | null;
  code_coverage_mentioned: boolean;
  build_system: string | null;
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

interface CommunityHealth {
  open_issues: number | null;
  closed_issues: number | null;
  contributors: number | null;
  last_commit_days_ago: number | null;
  has_contributing_guide: boolean;
  has_code_of_conduct: boolean;
  bus_factor_estimate: "low" | "medium" | "high";
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

interface DocumentationQuality {
  readme_sections: string[];
  has_docs_directory: boolean;
  has_api_docs: boolean;
  api_docs_type: string | null;  // "JSDoc" | "Swagger" | "Sphinx" etc.
  has_examples: boolean;
  has_changelog: boolean;
  has_tutorials: boolean;
  overall_grade: "comprehensive" | "adequate" | "minimal" | "missing";
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

interface SecurityPosture {
  has_security_policy: boolean;
  has_env_example: boolean;
  env_vars_documented: boolean;
  license_type: string;
  license_commercial_friendly: boolean;
  known_vulnerabilities_mentioned: boolean;
  auth_patterns: string[];
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

interface GettingStarted {
  prerequisites: string[];
  install_commands: string[];    // Copy-pasteable
  first_run_command: string | null;
  env_setup_steps: string[];
  common_pitfalls: string[];
  estimated_setup_time: string | null;  // "5 minutes", "30 minutes"
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

// Extended DeepDiveResult (v2)
interface DeepDiveResultV2 {
  // Metadata (same as v1)
  repo_url: string;
  repo_name: string;
  stars: number;
  contributors: number | null;
  license: string;
  primary_language: string;
  last_updated: string;

  // Enhanced existing sections
  overview: EnhancedSection;           // was: what_it_does
  why_it_stands_out: EnhancedSection;  // enhanced with sources[]
  tech_stack: {
    languages: string[];
    frameworks: Array<{ name: string; version?: string; url?: string }>;
    infrastructure: string[];
    key_dependencies: Array<{ name: string; version?: string; url?: string }>;
    confidence: "high" | "medium" | "low";
    sources: SourceLink[];
  };
  architecture: EnhancedSection;       // enhanced with sources[]

  // New sections
  code_quality: CodeQuality;
  community_health: CommunityHealth;
  documentation_quality: DocumentationQuality;
  security_posture: SecurityPosture;
  getting_started: GettingStarted;

  // Enhanced existing sections
  ai_patterns: AIPatterns & { sources: SourceLink[] };
  skills_required: {
    technical: string[];
    design: string[];
    domain: string[];
  };
  mode_specific: EnhancedSection;
}

// Extended Summary (v2)
interface ScoutSummaryV2 {
  takeaways: string[];
  recommendation: {
    repo: string;
    repo_url: string;
    reason: string;
    mode: "learn" | "build" | "scout";
  };
  comparative_matrix: {
    dimensions: string[];
    repos: Array<{
      repo_name: string;
      values: Record<string, string>;
    }>;
  };
  skills_roadmap: Array<{
    step: number;
    skill: string;
    description: string;
  }>;
  ecosystem_gaps: Array<{
    gap: string;
    opportunity: string;
  }>;
  ai_ecosystem_notes: string;
}
```

---

## Component Structure

### New Components

```
app/scout/[id]/deep-dive/
  page.tsx                        ← Server component, loads searchId
  DeepDivePageClient.tsx          ← Client component, orchestrates everything

components/deep-dive-page/
  DeepDiveHeader.tsx              ← Back button + title + query display
  DeepDiveSidebar.tsx             ← Sticky sidebar with anchor links + active tracking
  ExecutiveSummary.tsx            ← Key takeaways, recommendation, skills roadmap
  ComparativeMatrix.tsx           ← Side-by-side repo comparison table
  RepoAnalysisCard.tsx            ← Full 12-section expanded analysis per repo
  EcosystemGaps.tsx               ← Gaps and opportunities section
  SourceLink.tsx                  ← Reusable inline [source](url) component
  SectionSkeleton.tsx             ← Loading skeleton for progressive reveal
```

### Reused Components
- `ConfidenceIndicator.tsx` — existing, reuse as-is
- `TechStackSection.tsx` — enhance with version numbers and links
- `AIPatternsSection.tsx` — enhance with sources
- `SkillsSection.tsx` — reuse as-is
- `FeedbackWidget.tsx` — reuse for per-repo feedback

### Removed/Replaced Components (on this page)
- `DeepDiveCard.tsx` — replaced by `RepoAnalysisCard.tsx` (expanded, no accordions)
- `SummaryPanel.tsx` — replaced by `ExecutiveSummary.tsx` (richer)
- `DeepDiveCTA.tsx` — stays on search results page but changes behavior

---

## API Changes

### New API Route: None needed

The existing `/api/scout/[id]/deep-dive` route works with modifications:
- Accept the new expanded analysis format
- Return `DeepDiveResultV2` instead of `DeepDiveResult`

### Modified: `lib/deep-dive-analyzer.ts`

Complete rewrite of the analysis pipeline:
1. New `fetchRepoData()` function — parallel Node.js HTTP fetches
2. New `analyzeRepoV2()` function — parallel LLM calls with pre-loaded data
3. New section-specific prompt builders for each LLM call group
4. New parsers for each new section type
5. Updated `persistDeepDive()` to handle V2 schema

### Modified: Deep Dive SSE Route

- Emit `deep_dive_progress` events during fetch phase (e.g., "Fetching README...")
- Emit per-repo results as `deep_dive_complete` with V2 data
- Emit `summary` with V2 summary (includes comparative matrix)

---

## Supabase Schema

No schema migration needed — `search_results.deep_dive` is a JSONB column that accepts any JSON structure. The V2 format will coexist with V1 results in the database.

The page component should handle both V1 and V2 formats gracefully (check for `overview` vs `what_it_does` to detect version).

---

## Migration / Backward Compatibility

- V1 deep dive results in DB remain valid — the new page renders them with reduced sections
- New analyses produce V2 format
- The old `DeepDiveCard.tsx` component remains for any legacy rendering needs
- Search results page removes inline deep dive cards — deep dive is now always a separate page
- Background precompute switches to V2 analyzer

---

## Success Criteria

1. Clicking "Deep Dive" navigates to `/scout/[id]/deep-dive` with no re-analysis if results exist
2. Page shows 12 detailed sections per repo with inline source links
3. Analysis completes in ~29s wall-clock for 3 repos (parallel fetch + parallel LLM)
4. Sticky sidebar with active section tracking works on desktop
5. Progressive reveal: repos appear as they complete with skeleton placeholders
6. Back button returns to search results page with state preserved
7. Background precompute uses V2 analyzer for instant page loads
