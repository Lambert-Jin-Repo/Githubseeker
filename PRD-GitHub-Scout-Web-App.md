# Product Requirements Document (PRD)
# GitHub Scout — AI-Powered Repository Intelligence Platform

**Version:** 1.0  
**Date:** February 25, 2026  
**Author:** Liangbo Jin  
**Status:** Draft  
**Deployment:** Vercel (Frontend) + Supabase (Backend/DB)

---

## 1. Executive Summary

GitHub Scout is a web application that transforms how developers discover, evaluate, and learn from open-source repositories. Powered by an AI agent skill system, it goes far beyond simple GitHub search — it analyzes code architecture, identifies AI skill patterns, maps agentic structures, cross-validates findings through multiple sources, and delivers verified, actionable intelligence.

The platform serves three user intents: **LEARN** (study code patterns and build skills), **BUILD** (find production-ready templates and architectures), and **SCOUT** (map competitive landscapes and discover opportunities). Every piece of information returned is verified through a multi-layer validation pipeline, eliminating the hallucinated or stale data that plagues raw LLM-powered tools.

**Core differentiator:** This is not a search engine — it's an intelligent research analyst that reads code, validates community sentiment, checks liveness, extracts architecture patterns, and delivers structured recommendations with confidence scores.

---

## 2. Problem Statement

### Problems We Solve

1. **Discovery overload.** GitHub has 400M+ repositories. Searching for "AI agent framework" returns thousands of results with no quality signal. Developers waste hours sifting through abandoned repos, forks, and vanity projects.

2. **No architecture visibility.** Finding a repo is step one. Understanding its code structure, design patterns, tech stack decisions, and whether it represents good practice requires deep manual review of README, folder structures, and source code.

3. **AI/agentic pattern fragmentation.** The AI agent ecosystem (skills, MCP servers, cursor rules, LangChain chains, LlamaIndex pipelines) is evolving daily. There's no single place to discover what AI skill patterns exist for a given domain.

4. **Stale and fabricated data.** LLM-based tools often hallucinate repository details, invent star counts, or reference archived projects. Users need verified, current data they can trust.

5. **No cross-validation.** GitHub stars can be inflated. A repo might have 10k stars but negative community sentiment on Reddit, or zero real-world adoption. Single-source evaluation misleads.

### Who Has These Problems

- **Solo developers** learning new domains (LEARN mode)
- **Tech leads** evaluating build-vs-buy decisions (BUILD mode)
- **Product managers** mapping competitive landscapes (SCOUT mode)
- **AI/ML engineers** tracking agentic frameworks and skill patterns
- **Open-source contributors** looking for projects to join or gaps to fill

---

## 3. Product Vision

**One-liner:** "The smartest way to discover what's been built, how it's built, and what's missing."

### Vision Statement

GitHub Scout becomes the go-to research platform for any developer who needs to understand the open-source landscape around a topic — especially in the fast-moving AI/agentic space. It replaces hours of manual GitHub browsing, Reddit scanning, and blog reading with a single, verified, structured intelligence report.

### Success Metrics (v1.0 Launch)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first useful result | < 30 seconds | From query submission to Quick Scan table render |
| Verification rate | > 90% | % of repos in results with live-verified metadata |
| User completes Phase 2 | > 40% | % of sessions where user selects repos for Deep Dive |
| Result accuracy | > 95% | % of repo links that are live and metadata matches |
| Weekly active users | 500+ | Within first 3 months |

---

## 4. User Personas

### Persona 1: Alex — The Learner
- **Role:** Junior developer, 1-2 years experience
- **Goal:** Wants to learn how to build AI agents by studying real code
- **Behavior:** Searches "AI agent frameworks," gets overwhelmed by results, doesn't know which repos are well-architected vs. hobby projects
- **Need:** Curated learning pathways, "start here" recommendations, skill maps

### Persona 2: Mei — The Builder
- **Role:** Senior engineer at a startup
- **Goal:** Needs a production-ready template for an AI-powered SaaS product
- **Behavior:** Evaluates 5-10 repos manually, reads READMEs, checks issue activity, asks on Reddit. Takes 2-3 days.
- **Need:** Side-by-side architecture comparison, tech stack analysis, "ready to fork" confidence

### Persona 3: Jordan — The Scout
- **Role:** Product manager / Tech lead
- **Goal:** Mapping the competitive landscape of open-source CRM tools before a build-vs-buy decision
- **Behavior:** Creates spreadsheets comparing features, pricing, community size. Misses important projects.
- **Need:** Comprehensive landscape view, gap analysis, opportunity identification

---

## 5. Feature Specification

### 5.1 Core Features (MVP — v1.0)

#### F1: Smart Topic Input & Mode Detection
**Description:** A single search input that accepts natural language queries. The system auto-detects the user's intent (LEARN / BUILD / SCOUT) from their phrasing and displays the detected mode with an option to override.

**Functional Requirements:**
- Text input field accepting free-form queries (3-200 characters)
- Real-time mode detection as user types (debounced, 500ms)
- Mode indicator showing detected mode with explanation tooltip
- Manual mode override via toggle/selector
- Input validation: reject queries under 3 characters, show helpful suggestions for vague queries
- Query history (stored in Supabase, last 20 queries per user)
- Example queries shown as placeholder/suggestions for new users

**Mode Detection Logic (runs client-side for speed, confirmed server-side):**
```
LEARN triggers: "learn", "teach", "tutorial", "how to", "beginner", "study", "understand", "skills for"
BUILD triggers: "build", "create", "template", "boilerplate", "stack", "implement", "architecture", "starter"
SCOUT triggers: "what exists", "alternatives", "compare", "landscape", "trending", "overview", "tools for"
AMBIGUOUS: No trigger detected → show mode selector before proceeding
```

#### F2: Multi-Strategy Search Pipeline
**Description:** The backend executes 4-6 parallel search strategies, each targeting a different repository population to maximize coverage and minimize blind spots.

**Functional Requirements:**
- Execute searches based on the GitHub Scout skill templates (see skill file Step 3)
- Search strategies run in parallel where possible
- Results are deduplicated by normalized GitHub URL
- Each result tagged with which search strategy found it
- Results that appear in multiple strategies get a "multi-signal" boost
- Total search time budget: 15 seconds max for Phase 1
- Show real-time progress: "Searching high-star repos... Checking awesome lists... Scanning recent roundups..."

**Search Strategies per Mode:**

| Strategy | LEARN | BUILD | SCOUT |
|----------|-------|-------|-------|
| High-star repos (`site:github.com {topic} stars`) | ✓ | ✓ | ✓ |
| Awesome lists (`site:github.com awesome-{topic}`) | ✓ | ✓ | ✓ |
| Topic pages (`site:github.com/topics {topic}`) | ✓ | ✓ | ✓ |
| Editorial roundups (`best open source {topic} 2025`) | ✓ | ✓ | ✓ |
| Architecture patterns (`{topic} system design github`) | ✓ | ✓ | — |
| Competitive landscape (`{topic} open source alternatives 2025`) | — | — | ✓ |
| AI skill patterns (`{topic} AI agent skill cursor rules`) | ✓ | ✓ | ✓ |

#### F3: Multi-Layer Verification Pipeline
**Description:** Every repository in the results goes through a verification pipeline that confirms its existence, validates metadata, and cross-references community sentiment. This is the trust layer that differentiates GitHub Scout from raw LLM output.

**Verification Layers:**

| Layer | What It Checks | How | Badge |
|-------|---------------|-----|-------|
| **L1: Existence** | Repo URL is live, not 404 | `web_fetch` the GitHub page | ✓ Live / ✗ Dead |
| **L2: Metadata** | Stars, last commit, language, license match claimed values | Parse from fetched page | ✓ Verified / ⚠ Unverified |
| **L3: Freshness** | Last commit within recency window | Compare dates | 🟢 Active / 🟡 Stale / 🔴 Archived |
| **L4: Community** | Reddit/HN/forum sentiment | Search `{repo} reddit recommendations` | ✓ Validated / ~ Inferred / — No data |
| **L5: README Quality** | Has install instructions, examples, architecture docs | Analyze fetched README | Score 1-5 |

**Verification Budget:**
- L1+L2: Mandatory for ALL repos shown in Quick Scan (top 15-25)
- L3: Mandatory for ALL repos
- L4: Only for Tier 1 and Tier 2 repos (top 8-12), max 3 Reddit searches
- L5: Only for repos selected for Deep Dive (Phase 2)

**Verification Display:**
Each repo row shows verification badges inline. A summary line shows: "18 repos found · 16 verified · 2 unverified"

#### F4: Quick Scan Results Table (Phase 1 Output)
**Description:** An interactive, sortable table showing all discovered repositories with their quality assessments and verification badges.

**Functional Requirements:**
- Table columns: Select (checkbox), Rank, Repository Name (linked), Stars, Last Active, Primary Language, Quality Tier (★★★/★★/★), Verification Status, Reddit Signal, One-line Summary
- Sortable by: Stars, Last Active, Quality Tier
- Filterable by: Language, Quality Tier, Verification Status, Mode-relevant tags
- Selectable: Checkboxes for choosing repos for Phase 2 Deep Dive (max 5)
- Expandable rows: Click to see extended description, tech stack preview, why it was included
- Responsive: Works on mobile (cards view) and desktop (table view)
- Export: Download as JSON or Markdown

**Above the table:**
- Search metadata: Mode, topic, number of searches run, number of repos evaluated, number verified
- Observations panel: 2-3 AI-generated sentences about patterns noticed (dominant stacks, gaps, surprises)

**Below the table:**
- "Curated Lists Found" section (awesome lists discovered)
- "Industry Tools & Frameworks" section (non-GitHub tools relevant to the topic)
- CTA button: "Deep Dive Selected Repos (0/5)" — enabled when ≥1 repo selected

#### F5: Deep Dive Analysis (Phase 2 Output)
**Description:** For each user-selected repo, produce a structured analysis card with architecture insights, tech stack breakdown, skill requirements, and mode-specific guidance.

**Deep Dive Card Sections (all repos):**
1. **Header:** Repo name, URL, stars, contributors, license, primary language, last updated
2. **What It Does:** 2-3 sentence purpose summary
3. **Why It Stands Out:** What makes this notable vs. alternatives
4. **Technology Stack:** Languages, frameworks, infra/DevOps, key dependencies
5. **Architecture & Design Insights:** Patterns, code organization, folder structure analysis
6. **AI & Agentic Patterns Detected:** (NEW — not in original skill)
   - Does this repo use AI agent patterns? (skills, MCP, tool use, chains)
   - What AI frameworks are in the dependency tree? (LangChain, LlamaIndex, Anthropic SDK, OpenAI SDK)
   - Are there cursor rules, .claude files, or similar AI skill configurations?
   - Architecture pattern: monolithic agent, multi-agent, tool-calling, RAG, etc.
7. **Skills Required:** Technical, design, and domain skills needed

**Mode-Specific Sections (append ONE based on mode):**

| LEARN Mode | BUILD Mode | SCOUT Mode |
|------------|------------|------------|
| Learning Pathway | Build Guide | Market & Ecosystem Position |
| Prerequisites | Reusable Components | Target Audience |
| Start Here Files | Starter Approach | Competitive Advantage |
| Practice Project Ideas | Key Design Decisions | Gaps & Weaknesses |
| Related Resources | Pitfalls to Avoid | Opportunity Analysis |

**Deep Dive Verification:**
- All data points sourced from fetched repo page or README
- "Confidence" indicator per section: High (from repo page) / Medium (from README) / Low (inferred)
- Link to source for each claim where possible

#### F6: Summary & Recommendations (Phase 2 Closing)
**Description:** After all Deep Dives complete, present a synthesis panel with key takeaways, recommended starting points, skills roadmap, and ecosystem gaps.

**Sections:**
- Key Takeaways (3-5 points across all analyzed repos)
- Recommended Starting Points (tailored per mode)
- Skills Roadmap (ordered from foundational → advanced)
- Gaps Discovered (what doesn't exist yet, underserved areas)
- AI/Agentic Ecosystem Notes (what agent patterns are emerging in this space)

#### F7: Streaming Progress UI
**Description:** The two-phase workflow streams results to the user in real-time rather than waiting for all processing to complete.

**Phase 1 Streaming:**
```
[Topic accepted] → "Searching for AI agent frameworks..."
[Search 1 complete] → Search chip appears: "High-star repos ✓ (8 found)"
[Search 2 complete] → "Awesome lists ✓ (3 found)"
...
[Dedup complete] → "22 unique repos found, verifying..."
[Verification streaming] → Repos appear one by one in the table as verified
[Reddit validation] → Reddit badges update in-place on existing rows
[Complete] → Table is fully interactive, CTA enabled
```

**Phase 2 Streaming:**
```
[User selects 3 repos] → "Analyzing repo 1/3..."
[Deep Dive 1 streams] → Card content appears section by section
[Deep Dive 2 streams] → Next card streams
...
[All complete] → Summary panel appears
```

### 5.2 Data Architecture (Supabase)

#### Tables

**`searches`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| user_id | text | Anonymous session ID or authenticated user ID |
| query | text | Raw user input |
| mode | enum | LEARN / BUILD / SCOUT |
| created_at | timestamptz | |
| phase1_complete | boolean | |
| phase2_complete | boolean | |

**`search_results`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| search_id | uuid (FK → searches) | |
| repo_url | text | Normalized GitHub URL |
| repo_name | text | owner/name |
| stars | integer | Verified star count |
| last_commit | date | Verified last commit date |
| primary_language | text | |
| license | text | |
| quality_tier | integer | 1, 2, or 3 |
| verification_status | jsonb | `{existence: true, metadata: true, freshness: "active", community: "validated", readme_score: 4}` |
| reddit_signal | text | "validated" / "mixed" / "no_data" |
| summary | text | One-line AI-generated summary |
| deep_dive | jsonb | Full deep dive analysis (null until Phase 2) |
| source_strategies | text[] | Which search strategies found this repo |
| created_at | timestamptz | |

**`skill_versions`** (for iteration system)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| version | text | e.g., "1.0.1" |
| skill_content | text | Full SKILL.md content |
| eval_scores | jsonb | Compliance scores from self-testing |
| active | boolean | Is this the currently deployed version |
| created_at | timestamptz | |

**`feedback`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| search_id | uuid (FK → searches) | |
| repo_url | text | Which repo the feedback is about |
| signal | text | "useful" / "not_useful" / "inaccurate" |
| comment | text | Optional freeform |
| created_at | timestamptz | |

#### Supabase Row Level Security
- Anonymous users: can read/write their own searches (via session ID stored in cookie)
- No cross-user data access
- Skill versions: read-only for all users, write-only for admin

### 5.3 API Architecture

#### API Routes (Next.js App Router)

**`POST /api/scout`** — Initiate a new scout session
```json
// Request
{
  "query": "AI agent frameworks for customer support",
  "mode": "BUILD",  // optional, auto-detected if omitted
  "config": {        // optional overrides
    "min_stars": 100,
    "recency_months": 12,
    "reddit_validation": true,
    "max_results": 25
  }
}

// Response: Server-Sent Events (SSE) stream
event: mode_detected
data: {"mode": "BUILD", "topic": "AI agent frameworks customer support", "confidence": 0.92}

event: search_progress
data: {"strategy": "high_star", "status": "complete", "repos_found": 8}

event: repo_discovered
data: {"repo_url": "https://github.com/...", "repo_name": "...", "stars": 5200, "verified": true, ...}

event: verification_update
data: {"repo_url": "...", "verification": {"existence": true, "metadata": true, ...}}

event: phase1_complete
data: {"total_repos": 22, "verified": 20, "unverified": 2}
```

**`POST /api/scout/:id/deep-dive`** — Request Phase 2 analysis
```json
// Request
{
  "repo_urls": [
    "https://github.com/owner/repo1",
    "https://github.com/owner/repo2",
    "https://github.com/owner/repo3"
  ]
}

// Response: SSE stream
event: deep_dive_start
data: {"repo_url": "...", "index": 1, "total": 3}

event: deep_dive_section
data: {"repo_url": "...", "section": "what_it_does", "content": "..."}

event: deep_dive_section
data: {"repo_url": "...", "section": "tech_stack", "content": {...}}

event: deep_dive_complete
data: {"repo_url": "...", "full_analysis": {...}}

event: summary
data: {"takeaways": [...], "recommendations": {...}, "skills_roadmap": [...], "gaps": [...]}
```

**`POST /api/feedback`** — Submit user feedback on results
```json
{
  "search_id": "uuid",
  "repo_url": "https://github.com/...",
  "signal": "useful",
  "comment": "Great architecture breakdown"
}
```

**`GET /api/search/history`** — Get user's past searches

### 5.4 AI Integration Layer

**LLM Provider:** Anthropic Claude API (claude-sonnet-4-20250514)

**System Prompt Strategy:**
The GitHub Scout skill file (SKILL.md) is injected as the system prompt for all Claude API calls. The skill version is tracked in Supabase, allowing A/B testing between versions.

**Tool Use Configuration:**
Claude API calls include the `web_search` tool for repository discovery and Reddit validation. For Deep Dive analysis, `web_fetch` is used to retrieve actual repo pages and READMEs.

```javascript
// Simplified API integration pattern
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: skillFileContent,  // GitHub Scout SKILL.md
    tools: [
      { type: "web_search_20250305", name: "web_search" }
    ],
    messages: [
      { role: "user", content: constructedPrompt }
    ],
    stream: true  // Enable streaming for real-time UI updates
  })
});
```

**Prompt Construction per Phase:**

Phase 1 prompt template:
```
You are executing a GitHub Scout search in {MODE} mode.

Topic: {user_query}
Configuration: {config_overrides}

Execute the Phase 1 Discovery workflow from your skill instructions.
Return results as structured JSON for each repo found.
For each repo, you MUST verify existence by fetching the actual GitHub page.
Mark any unverified data points explicitly.

Output format for each repo:
{
  "repo_url": "...",
  "repo_name": "...",
  "stars": number | "unverified",
  "last_commit": "YYYY-MM-DD" | "unverified",
  "primary_language": "...",
  "license": "...",
  "quality_tier": 1|2|3,
  "verification": { ... },
  "reddit_signal": "validated"|"mixed"|"no_data",
  "summary": "...",
  "source_strategies": ["high_star", "awesome_list", ...]
}
```

Phase 2 prompt template:
```
You are executing a GitHub Scout Deep Dive in {MODE} mode.

Analyze this repository: {repo_url}
Fetch the repo page and README. Extract real data only.

Produce the Deep Dive analysis following your skill instructions.
Additionally, analyze for AI & Agentic patterns:
- Check for: .cursor/, .claude, skills/, mcp/, langchain, llamaindex, openai, anthropic in dependencies
- Identify architecture pattern: monolithic agent, multi-agent, tool-calling, RAG, workflow
- Note any AI skill files or configurations

Return as structured JSON with confidence levels per section.
```

### 5.5 Secondary Features (v1.1+)

#### F8: Skill Iteration Dashboard (v1.1)
- Admin page showing all skill versions with eval scores
- Side-by-side comparison of version performance
- One-click rollback to previous skill version
- Automated eval runner: submit test prompts, score results

#### F9: Comparison View (v1.1)
- Select 2-3 repos from Quick Scan or Deep Dive
- Side-by-side comparison table: tech stack, architecture, quality, community

#### F10: Export & Share (v1.1)
- Export full report as PDF or Markdown
- Shareable URL for any completed search (public read-only link)
- Embed widget for blog posts / documentation

#### F11: Saved Searches & Alerts (v1.2)
- Save searches to dashboard
- Weekly email digest: "New repos matching your saved search for AI agent frameworks"
- Trend tracking: see how a topic's repo landscape changes over time

#### F12: Authentication & Personalization (v1.2)
- Supabase Auth (GitHub OAuth recommended — users are developers)
- Saved search history persists across devices
- Personalized recommendations based on past searches and feedback

---

## 6. Technical Architecture

### 6.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Vercel                           │
│  ┌──────────────┐  ┌────────────────────────────────┐   │
│  │  Next.js App  │  │  API Routes (Edge Functions)   │   │
│  │  (React/RSC)  │  │  /api/scout                    │   │
│  │               │  │  /api/scout/:id/deep-dive      │   │
│  │  Pages:       │  │  /api/feedback                 │   │
│  │  - Home       │  │  /api/search/history           │   │
│  │  - Results    │  │                                │   │
│  │  - Deep Dive  │  │  ┌──────────────────────┐      │   │
│  │  - History    │  │  │  Claude API Client    │      │   │
│  └──────┬───────┘  │  │  (Streaming + Tools)  │      │   │
│         │          │  └──────────┬───────────┘      │   │
│         │          └─────────────┼──────────────────┘   │
└─────────┼────────────────────────┼──────────────────────┘
          │                        │
          │ DB reads               │ LLM calls + web search
          ▼                        ▼
┌──────────────────┐    ┌──────────────────┐
│    Supabase      │    │  Anthropic API   │
│  - PostgreSQL    │    │  - Claude Sonnet │
│  - Auth          │    │  - Web Search    │
│  - Realtime      │    │  - Web Fetch     │
│  - Storage       │    └──────────────────┘
└──────────────────┘
```

### 6.2 Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Next.js 15 (App Router) | RSC for fast loads, API routes for backend, SSE support |
| **Language** | TypeScript | Type safety for complex data structures |
| **Styling** | Tailwind CSS + shadcn/ui | *Style details deferred to design agent* |
| **State** | Zustand or React Context | Manage streaming results, selections, mode |
| **Database** | Supabase (PostgreSQL) | Auth, realtime subscriptions, JSONB for flexible schemas |
| **AI** | Anthropic Claude API | Tool use (web_search), streaming, structured output |
| **Deployment** | Vercel | Edge functions, instant deploys, preview URLs |
| **Analytics** | Vercel Analytics or PostHog | Usage tracking, funnel analysis |

### 6.3 Key Technical Decisions

**Why SSE over WebSockets?**
The workflow is request-response with streaming, not bidirectional. SSE is simpler, works with Vercel Edge Functions, and auto-reconnects.

**Why Claude over OpenAI?**
Claude's tool use (web_search + web_fetch) is built-in and reliable. The skill file format is designed for Claude's system prompt. Sonnet offers the best quality/cost/speed tradeoff for this use case.

**Why Supabase over raw Postgres?**
Auth, realtime subscriptions, and storage are all needed and come free. Supabase's JS client integrates cleanly with Next.js.

**Streaming architecture detail:**
```
Client (EventSource) ←── SSE ←── Next.js API Route ←── Claude API (streaming)
                                        │
                                        ├── Parse Claude's tool_use blocks
                                        ├── Execute verification steps
                                        ├── Format as SSE events
                                        └── Write to Supabase (async, non-blocking)
```

---

## 7. Verification System — Deep Technical Spec

This is the most critical system in the application. It must be reliable, transparent, and fast.

### 7.1 Verification Pipeline

```
Raw search results (from Claude + web_search)
    │
    ▼
┌─────────────────────┐
│  L1: URL Validation  │  ── web_fetch each GitHub URL
│  - Is it a 200?      │  ── Is it actually a GitHub repo page?
│  - Is it a fork?     │  ── Extract canonical URL
└────────┬────────────┘
         │ Pass: continue │ Fail: mark "dead", exclude
         ▼
┌─────────────────────┐
│  L2: Metadata Extract│  ── Parse stars, language, license from page
│  - Stars match claim?│  ── Flag discrepancies > 20%
│  - Language correct?  │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  L3: Freshness Check │  ── Last commit date from page
│  - Active: < 6mo     │  ── Stale: 6-18mo
│  - Archived: > 18mo  │  ── Check for "archived" banner
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  L4: Community Signal│  ── Reddit search (Tier 1-2 only)
│  - Positive threads  │  ── web_fetch thread if found
│  - Negative warnings │  ── Confidence: confirmed/inferred/none
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  L5: README Analysis │  ── Phase 2 only (Deep Dive)
│  - Has install guide │  ── Has examples
│  - Has architecture  │  ── Has contributing guide
│  - AI patterns found │
└─────────────────────┘
```

### 7.2 Verification Display Contract

Every data point shown to users must carry a verification badge:

```typescript
type VerificationLevel = 
  | "verified"     // Confirmed by fetching the actual source
  | "inferred"     // Extracted from search snippet, not independently confirmed
  | "unverified"   // Could not be confirmed
  | "stale"        // Was verified but source data is > 30 days old
  | "conflicting"; // Multiple sources disagree

interface RepoVerification {
  existence: { status: "live" | "dead" | "redirect"; checked_at: string };
  stars: { value: number; level: VerificationLevel; source: string };
  last_commit: { value: string; level: VerificationLevel };
  language: { value: string; level: VerificationLevel };
  license: { value: string; level: VerificationLevel };
  freshness: { status: "active" | "stale" | "archived"; level: VerificationLevel };
  community: { signal: "validated" | "mixed" | "no_data"; level: VerificationLevel; details?: string };
  readme_quality: { score: number; level: VerificationLevel }; // Phase 2 only
}
```

### 7.3 Anti-Hallucination Rules

These rules are enforced at the API route level, not just in the prompt:

1. **No star count without source.** If Claude returns a star count, the API route must have a corresponding `web_fetch` or `web_search` result that contains that number. If not, downgrade to "unverified."
2. **No Reddit sentiment without search.** If Claude claims Reddit validation, there must be a corresponding `web_search` result containing "reddit.com." If not, override to "— No data."
3. **No repo URLs without search results.** Every repo URL in the output must trace back to a search result or fetched page. Fabricated URLs are caught by L1 verification.
4. **Staleness ceiling.** Search results older than 7 days trigger a re-verification on the next view.

---

## 8. AI & Agentic Pattern Detection (Unique Feature)

This is the feature that makes GitHub Scout uniquely valuable for the AI/agentic community.

### 8.1 What We Detect

| Pattern | Detection Method | Example |
|---------|-----------------|---------|
| **AI SDK Usage** | Scan `package.json`, `requirements.txt`, `pyproject.toml` for AI libraries | `anthropic`, `openai`, `langchain`, `llamaindex`, `autogen` |
| **Cursor/Windsurf Rules** | Check for `.cursorrules`, `.cursor/`, `.windsurfrules` files | Cursor IDE configuration files |
| **Claude Skills** | Check for `.claude/`, `SKILL.md`, `skills/` directories | Claude Code skill definitions |
| **MCP Servers** | Check for `mcp.json`, `mcp-server`, MCP protocol implementations | Model Context Protocol servers |
| **Agent Architecture** | Analyze code structure for agent patterns | Tool-calling loops, multi-agent orchestration, RAG pipelines |
| **Prompt Engineering** | Check for prompt templates, system prompts, few-shot examples | `prompts/`, `templates/`, system message files |

### 8.2 Output Format

```json
{
  "ai_patterns": {
    "has_ai_components": true,
    "sdks_detected": ["anthropic", "langchain"],
    "agent_architecture": "multi-agent-orchestration",
    "skill_files": [".cursorrules", "skills/SKILL.md"],
    "mcp_usage": false,
    "prompt_engineering": {
      "has_system_prompts": true,
      "has_few_shot": true,
      "prompt_location": "prompts/"
    },
    "confidence": "high",
    "summary": "This repo implements a multi-agent system using LangChain with Claude as the primary LLM. It includes cursor rules for IDE integration and a structured prompts directory."
  }
}
```

---

## 9. Page Structure & User Flow

### 9.1 Pages

**Page 1: Home (`/`)**
- Hero section with search input
- Mode detection indicator
- Example queries as clickable chips
- Recent searches (if returning user)

**Page 2: Results (`/scout/[id]`)**
- Search metadata bar (mode, topic, stats)
- Streaming progress indicators
- Quick Scan table (Phase 1)
- Observations panel
- Curated lists + industry tools sections
- Deep Dive selection CTA

**Page 3: Deep Dive (`/scout/[id]/deep-dive`)**
- Deep Dive cards for each selected repo
- AI/Agentic pattern analysis per repo
- Summary & Recommendations panel
- Export options

**Page 4: History (`/history`)**
- List of past searches with mode, date, repo count
- Click to revisit any completed search
- Delete / re-run options

### 9.2 User Flow Diagram

```
[Home Page]
    │
    ├─ Type query → mode auto-detected → click "Scout"
    │
    ▼
[Results Page — Phase 1]
    │
    ├─ Streaming: searches execute, repos appear in table
    ├─ Table becomes interactive when Phase 1 completes
    ├─ User sorts, filters, reads observations
    ├─ User checks 1-5 repos
    ├─ Clicks "Deep Dive Selected"
    │
    ▼
[Deep Dive Page — Phase 2]
    │
    ├─ Streaming: Deep Dive cards appear one by one
    ├─ AI pattern analysis included per repo
    ├─ Summary panel appears when all complete
    ├─ User can export, share, or provide feedback
    │
    ▼
[Done — saved to history]
```

---

## 10. Non-Functional Requirements

| Requirement | Target | Notes |
|-------------|--------|-------|
| **Phase 1 latency** | < 30s total | From query to complete table |
| **Phase 2 latency** | < 20s per repo | From selection to complete deep dive |
| **Time to first result** | < 5s | First repo appears in table |
| **Uptime** | 99.5% | Vercel + Supabase SLA |
| **Mobile responsive** | Full functionality | Cards view on mobile, table on desktop |
| **Accessibility** | WCAG 2.1 AA | Keyboard navigation, screen reader support |
| **SEO** | Public search pages indexable | SSR for completed searches |
| **Rate limiting** | 10 searches/hour/IP (anon), 30/hour (auth) | Prevent abuse |
| **Data retention** | 90 days for anonymous, unlimited for auth | Configurable |
| **Cost ceiling** | < $0.50 per full search (Phase 1 + 2) | Monitor Claude API usage |

---

## 11. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Claude API rate limits | Searches fail or queue | Medium | Implement retry with backoff; cache recent results |
| GitHub blocks web_fetch | Verification fails | Low | Fallback to search snippet data; mark as "unverified" |
| Reddit search unreliable | Community validation degrades | High | Two-pass strategy (see skill v1.0.2); fallback to HN/forum |
| Stale search results | Users see outdated repos | Medium | Freshness timestamps on all data; re-verify on revisit |
| High API costs | Unsustainable per-search cost | Medium | Cache aggressively; limit Phase 1 to 6 searches; Sonnet over Opus |
| Skill regression | New skill version performs worse | Medium | A/B test before deploying; auto-rollback on score drop |

---

## 12. Launch Plan

### Phase 1: MVP (4-6 weeks)
- Home page with search input + mode detection
- Phase 1 streaming results table
- Phase 2 Deep Dive with AI pattern analysis
- Supabase storage for search results
- Basic feedback mechanism
- Deploy on Vercel

### Phase 2: Polish (2-3 weeks after MVP)
- Comparison view
- Export (Markdown, PDF)
- Search history page
- Mobile optimization
- Error states and edge case handling

### Phase 3: Growth (ongoing)
- GitHub OAuth
- Saved searches + alerts
- Skill iteration dashboard
- Shareable search URLs
- Analytics dashboard

---

## 13. Open Questions

1. **Authentication strategy for v1.0:** Do we require login, or allow anonymous searches with session-based history?
   - *Recommendation:* Anonymous with optional GitHub OAuth. Lower friction = more usage.

2. **Caching strategy:** How long do we cache search results before re-running?
   - *Recommendation:* 24 hours for Phase 1, 7 days for Phase 2. "Refresh" button forces re-run.

3. **Multi-language support:** Should the UI support non-English?
   - *Recommendation:* English only for v1.0. Repo content analysis works for English READMEs only.

4. **Public API:** Should we expose the scout functionality as an API for third-party integrations?
   - *Recommendation:* Not for v1.0. Consider for v2.0 based on demand.

---

*End of PRD*
