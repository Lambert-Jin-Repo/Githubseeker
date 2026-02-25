# GitHub Scout — Implementation Design

**Date:** 2026-02-25
**Approach:** Vertical Slice (end-to-end thin path first, then widen)
**Auth model:** Anonymous only (session UUID in cookie)
**Supabase:** Existing project (credentials provided)
**AI Provider:** MiniMax M2.5 API + Brave Search API (custom tool calling)

---

## Decisions

- **Package manager:** npm
- **Framework:** Next.js 15 App Router, TypeScript strict, Tailwind CSS, shadcn/ui
- **State:** Zustand
- **Streaming:** SSE (Server-Sent Events) via Next.js API routes
- **AI:** MiniMax M2.5 via OpenAI-compatible API with custom tool definitions (web_search → Brave Search, web_fetch → server-side fetch)
- **Database:** Supabase PostgreSQL with RLS
- **Auth (v1.0):** Anonymous — UUID generated on first visit, stored in cookie
- **Deployment:** Vercel

---

## Implementation Order

### Phase 1: Foundation

1. **Project scaffold** — Next.js 15, TypeScript, Tailwind, shadcn/ui, Zustand
2. **Git init** — `.gitignore`, `.env.local` template
3. **Supabase schema** — Apply migration: 4 tables (`searches`, `search_results`, `feedback`, `skill_versions`), indexes, RLS policies
4. **Core lib files** — `lib/types.ts` (all interfaces), `lib/supabase.ts`, `lib/mode-detection.ts`, `lib/url-normalize.ts`, `lib/verification.ts`

### Phase 2: Vertical Slice (Home → Search → Results)

5. **Home page** — `SearchInput`, `ModeIndicator`, `ModeSelector`, `ExampleQueries`
6. **Zustand store** — `stores/scout-store.ts` with full state shape and actions
7. **API route: POST /api/scout** — Claude API integration, SSE streaming, Supabase persistence
8. **SSE hook: useScoutStream** — EventSource connection, event parsing, auto-reconnect
9. **Results page** — `SearchMetaBar`, `StreamingProgress`, `QuickScanTable`, `RepoRow`
10. **Verification badges** — `VerificationBadge`, `QualityTierBadge`, `RedditSignalBadge`
11. **Observations + supplementary** — `ObservationsPanel`, `CuratedListsSection`, `IndustryToolsSection`
12. **Deep Dive CTA** — `DeepDiveCTA` sticky bottom bar with selection counter

### Phase 3: Deep Dive

13. **API route: POST /api/scout/[id]/deep-dive** — Sequential Claude calls per repo, SSE streaming, AI pattern extraction
14. **SSE hook: useDeepDiveStream** — POST + EventSource, progress tracking
15. **Deep Dive cards** — `DeepDiveCard`, `TechStackSection`, `ArchitectureSection`, `SkillsSection`, `ModeSpecificSection`, `ConfidenceIndicator`
16. **AI Patterns section** — `AIPatternsSection` (visually distinct, key differentiator)
17. **Summary panel** — `SummaryPanel` with takeaways, recommendations, skills roadmap, gaps
18. **Feedback** — `FeedbackWidget` + `POST /api/feedback` route

### Phase 4: History + Polish

19. **History page** — `GET /api/search/history` route, `SearchHistoryList`, `SearchHistoryCard`
20. **Export** — `ExportButton` (Markdown + JSON, client-side download)
21. **Shared layout** — `Header`, `Footer`, root layout with providers
22. **Responsive** — Mobile card view for table, tablet column hiding, mobile-first Deep Dive cards
23. **Error states** — Loading skeletons, empty states, error states, SSE reconnection toast
24. **Accessibility** — Proper `<table>`, `aria-labels`, keyboard nav, `aria-live` regions, contrast

---

## Architecture Notes

### SSE Streaming Flow
```
Client (EventSource) <-- SSE <-- Next.js API Route <-- MiniMax M2.5 (agentic loop)
                                        |
                                        +-- M2.5 calls web_search → routed to Brave Search API
                                        +-- M2.5 calls web_fetch → routed to server-side fetch
                                        +-- Parse tool results, emit SSE events
                                        +-- Write to Supabase (async)
```

### Session Identity
- Generate UUID on first visit
- Store in HTTP-only cookie
- Pass as `user_id` to all Supabase queries
- RLS policies enforce per-session isolation

### MiniMax M2.5 Integration
- OpenAI-compatible API (uses `openai` npm package with custom baseURL)
- Custom tool definitions: `web_search` (→ Brave Search API), `web_fetch` (→ server-side fetch)
- Agentic loop: LLM calls tools → we execute → feed results back → repeat until done
- System prompt: GitHub Scout skill content
- Phase 1: web_search tool for discovery + verification
- Phase 2: web_search + web_fetch for deep analysis
- M2.5 interleaved thinking: reasons between tool calls for better planning
- ~10x cheaper per search vs Claude Sonnet (~$0.05 vs $0.50)
- Anti-hallucination rules enforced at API route level (not just in prompt)

### Verification Pipeline
- L1 (Existence): Mandatory for all repos — web_fetch GitHub URL
- L2 (Metadata): Mandatory — parse stars, language, license from fetched page
- L3 (Freshness): Mandatory — last commit date comparison
- L4 (Community): Top 8-12 repos only — Reddit search (max 3 searches)
- L5 (README): Phase 2 only — analyze README content

---

## Key Files (from Frontend Build Prompt)

```
app/page.tsx                           # Home
app/scout/[id]/page.tsx                # Results (Phase 1 + 2)
app/history/page.tsx                   # History
app/api/scout/route.ts                 # Phase 1 SSE endpoint
app/api/scout/[id]/deep-dive/route.ts  # Phase 2 SSE endpoint
app/api/feedback/route.ts              # Feedback submission
app/api/search/history/route.ts        # History retrieval
lib/types.ts                           # All TypeScript interfaces
lib/llm.ts                             # MiniMax M2.5 client + agentic tool loop
lib/brave-search.ts                    # Brave Search API + web fetch
stores/scout-store.ts                  # Zustand store
hooks/useScoutStream.ts                # Phase 1 SSE hook
hooks/useDeepDiveStream.ts             # Phase 2 SSE hook
```

---

## What's Deferred to v1.1+

- Comparison view (F9)
- PDF export (F10)
- Shareable URLs (F10)
- Saved searches + alerts (F11)
- GitHub OAuth (F12)
- Skill iteration dashboard (F8)
- Personalized recommendations (F12)
