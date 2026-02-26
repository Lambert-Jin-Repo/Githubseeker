# GitHub Scout — Master Project Tracker

**Project:** AI-powered repository intelligence platform
**Repo:** `/Users/liangbojin/Desktop/MyProject/Githubseeker`
**Branch:** `main`
**Dev Server:** `npm run dev -- -p 3333`

---

## Phase 1: Core Implementation (COMPLETE — 23 tasks, 25 commits)

**Date:** 2026-02-25
**Plan:** `docs/plans/2026-02-25-github-scout-plan.md`
**Design:** `docs/plans/2026-02-25-github-scout-implementation-design.md`

| # | Task | Status | Commit |
|---|---|---|---|
| 1 | Scaffold Next.js project with deps | done | `7da89f9` |
| 2 | Core TypeScript type definitions | done | `9312d78` |
| 3 | Supabase client + session identity | done | `c92aa91` |
| 4 | Mode detection logic | done | `23e5043` |
| 5 | URL normalization + deduplication | done | `962830f` |
| 6 | Verification status helpers | done | `9b5bc8d` |
| 7 | Zustand store for search state | done | `f527d31` |
| 8 | Header, Footer, LoadingSkeleton components | done | `bc5ae8f` |
| 9 | Home page with search input | done | `c2be8a6` |
| 10 | Design system (editorial light theme) | done | `355ac28` |
| 11 | Phase 1 search API (MiniMax M2.5 + search) | done | `c643a82` |
| 12 | SSE streaming hook | done | `fb19699` |
| 13 | Results page with quick scan table | done | `415621f` |
| 14 | Phase 2 deep dive API + SSE hook | done | `4af6f61` |
| 15 | Deep dive cards with AI patterns + summary | done | `0d0cd76` |
| 16 | Feedback system (thumbs up/down/flag) | done | `0ad8fb0` |
| 17 | Search history page | done | `8ffa9b2` |
| 18 | Export functionality (JSON/CSV/MD) | done | `0c47088` |
| 19 | Responsive design + accessibility | done | `99f80ec` |
| 20 | Switch Brave Search to Serper API | done | `6136e45` |
| 21 | Fix CSS parse error (font import order) | done | `14ec154` |
| 22 | Fix MiniMax global endpoint | done | `bacadf1` |
| 23 | Switch to accessibility-optimized fonts | done | `93fa353` |

---

## Phase 2: Supabase Persistence (COMPLETE — 10 tasks, 13 commits)

**Date:** 2026-02-26
**Design:** `docs/plans/2026-02-26-supabase-persistence-design.md`
**Plan:** `docs/plans/2026-02-26-supabase-persistence-plan.md`
**Tracker:** `docs/plans/2026-02-26-supabase-persistence-tracker.md`

| # | Task | Status | Commit(s) |
|---|---|---|---|
| 1 | Simplify `lib/supabase.ts` — service role client + session helper | done | `37a142c`, `e7252cf` |
| 2 | Wire Phase 1 POST — save search to `searches` table | done | `d65bf11` |
| 3 | Wire Phase 1 GET — save repos + observations on completion | done | `d65bf11`, `5e79809` |
| 4 | Wire Phase 2 — upsert `deep_dive` JSONB, set `phase2_complete` | done | `384f192` |
| 5 | Wire feedback — insert into `feedback` table | done | `7b42f99` |
| 6 | Wire history — replace in-memory with Supabase queries | done | `201d5f4` |
| 7 | New `GET /api/scout/[id]/results` endpoint | done | `bf8da7c` |
| 8 | Client — load saved results before SSE fallback | done | `4ceef57` |
| 9 | Place FeedbackWidget in RepoRow + DeepDiveCard | done | `96cbf13` |
| 10 | Place ExportButton in results page | done | `9f259a4` |
| — | Post-review: auth checks, robustness fixes | done | `baadbab` |
| — | Update tracker docs | done | `bf58bc7` |

### Post-Review Fixes Applied
- Authorization checks on `/api/scout/[id]/results` and `/api/scout/[id]/deep-dive`
- Empty `.in()` array guard in history endpoint
- `store.reset()` before hydrating saved results (React strict mode)
- Type guard for observations array
- Fixed misleading comment in POST handler

---

## Phase 8: Global Search Notification (COMPLETE — 5 commits)

**Date:** 2026-02-26
**Design:** `docs/plans/2026-02-26-global-search-notification-design.md`
**Branch:** `feature/global-search-notification` (merged to main)

| # | Task | Status | Commit(s) |
|---|---|---|---|
| 1 | Search notification Zustand store | done | `c137bb1` |
| 2 | Global SSE stream hook (layout-level) | done | `c137bb1` |
| 3 | Header status pill (GlobalSearchStatus) | done | `c137bb1` |
| 4 | Center notification card (SearchProgressNotification) | done | `c137bb1` |
| 5 | Home page — stop auto-navigation, show notification | done | `c137bb1` |
| 6 | Results page — dismiss notification on mount | done | `c137bb1` |
| 7 | CSS animation for status pill | done | `c137bb1` |
| — | Fix: SSE lifecycle — use Zustand subscribe instead of effect deps | done | `0cca022` |
| — | Fix: close SSE stream immediately after phase1_complete | done | `cfc7e68` |

### Key Changes
- Users stay on the home page after searching (no auto-navigation)
- Center notification card shows live progress: strategy tracking, repo counter, elapsed timer
- Header status pill persists across all pages (home, history, etc.)
- "View Results" button appears when search completes
- SSE stream closes immediately after phase1_complete (before Supabase persist / deep dive precompute)

---

## Phase 9: Portfolio Enhancements (COMPLETE — 10 tasks)

**Date:** 2026-02-26
**Branch:** `feature/portfolio-enhancements`

| # | Task | Status | Files Changed |
|---|---|---|---|
| 1 | Add `ThemeProvider` to layout | done | `app/layout.tsx` |
| 2 | Dark mode CSS variables | done | `app/globals.css` |
| 3 | Animated `ThemeToggle` component | done | `components/shared/ThemeToggle.tsx` (new) |
| 4 | Theme toggle + Dashboard link in Header | done | `components/shared/Header.tsx` |
| 5 | Fix `bg-white` hardcodes for dark mode (6 files) | done | `SearchMetaBar`, `DeepDiveCTA`, `ExecutiveSummary`, `SummaryPanel`, `loading.tsx`, `HistoryList` |
| 6 | Dashboard API endpoint | done | `app/api/dashboard/route.ts` (new) |
| 7 | Dashboard page | done | `app/dashboard/page.tsx` (new) |
| 8 | Dashboard content (stats, charts, empty/error) | done | `components/dashboard/DashboardContent.tsx` (new) |
| 9 | Reusable `ErrorBoundaryCard` component | done | `components/shared/ErrorBoundaryCard.tsx` (new) |
| 10 | History list — error retry, dark mode badges, improved empty state | done | `components/history/HistoryList.tsx` |
| 11 | Smooth theme transition CSS (200ms on all color properties) | done | `app/globals.css`, `app/layout.tsx` |
| 12 | Redesign GlobalSearchStatus pill (Framer Motion animations, dark mode) | done | `components/shared/GlobalSearchStatus.tsx` |
| 13 | Redesign SearchProgressNotification (animated progress bar, glassmorphism, stat chips) | done | `components/search/SearchProgressNotification.tsx` |

### Key Changes
- Dark/Light theme toggle with system preference detection, animated sun/moon icon
- Full dark color palette (deep navy bg `#0F1117`, bright teal accent `#14B8A6`)
- Smooth 200ms theme transition on all color properties (matching AI News Hub reference)
- Dashboard page with stat cards, mode distribution bar, top topics, recent activity
- Error retry pattern with reusable `ErrorBoundaryCard`
- 6 `bg-white` → `bg-background`/`bg-card` fixes for dark mode consistency
- Redesigned header search pill: spring animations, glow effect, hover scale, AnimatePresence text transitions
- Redesigned progress card: shimmer progress bar, rotating icon with pulse ring, glassmorphism card, stat chips with slide-in, whileHover/whileTap CTA button

---

## Phase 3: Polish & Robustness (NOT STARTED)

| # | Task | Priority | Status | Description |
|---|---|---|---|---|
| 1 | Error recovery for MiniMax API failures | P1 | `pending` | Show partial results + retry button if LLM fails mid-stream |
| 2 | Error recovery for Serper API failures | P1 | `pending` | Show helpful error state if search API fails |
| 3 | Search result caching | P1 | `pending` | Check if same query was searched recently; add "Refresh" button |
| 4 | Loading state improvements | P1 | `done` | Skeleton loading + error states added in Phase 9 |
| 5 | Singleton Supabase client | P2 | `pending` | `createServerClient()` creates new instance per call; use lazy singleton |
| 6 | Feedback deduplication | P2 | `pending` | Prevent duplicate feedback rows; use upsert or client-side guard |
| 7 | History endpoint optimization | P2 | `pending` | Replace full-row fetch with aggregate count query |
| 8 | Secure cookie flag | P2 | `pending` | Add `Secure` flag to session cookie for HTTPS production |
| 9 | Deep dive update verification | P2 | `pending` | Check affected row count after `update()` to catch URL mismatches |

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router), TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui (new-york) |
| AI | MiniMax M2.5 via OpenAI SDK (`api.minimax.io/v1`) |
| Search | Serper API (Google Search) at `google.serper.dev/search` |
| Database | Supabase (project: `fnylozxqgmnzvdbshzvn`, region: ap-southeast-1, free plan) |
| State | Zustand |
| Testing | Vitest (86 tests, 12 files) |
| Fonts | Literata (headings), Atkinson Hyperlegible Next (body), JetBrains Mono (code) |

## Key Files

| File | Purpose |
|---|---|
| `lib/supabase.ts` | Service role client + `getSessionUserId` helper |
| `lib/llm.ts` | Agentic tool loop (MiniMax + web_search/web_fetch) |
| `lib/web-search.ts` | Serper API client + fetchWebPage |
| `lib/session.ts` | Session cookie creation + UUID validation |
| `app/api/scout/route.ts` | Phase 1 POST (create search) + GET (SSE stream) |
| `app/api/scout/[id]/deep-dive/route.ts` | Phase 2 deep dive SSE stream |
| `app/api/scout/[id]/results/route.ts` | Load saved search results |
| `app/api/feedback/route.ts` | Persist feedback |
| `app/api/history/route.ts` | Query search history |
| `hooks/useScoutStream.ts` | Phase 1 SSE consumer (checks DB first) |
| `hooks/useGlobalSearchStream.ts` | Global SSE listener (layout-level, Zustand subscribe) |
| `hooks/useDeepDiveStream.ts` | Phase 2 SSE consumer |
| `stores/scout-store.ts` | Full Zustand store |
| `stores/search-notification-store.ts` | Global search notification state |
| `components/shared/GlobalSearchStatus.tsx` | Header status pill |
| `components/search/SearchProgressNotification.tsx` | Home page center notification |
| `supabase/migration.sql` | DB schema reference |

## Env Keys (in .env.local)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `MINIMAX_API_KEY`
- `SERPER_API_KEY`
