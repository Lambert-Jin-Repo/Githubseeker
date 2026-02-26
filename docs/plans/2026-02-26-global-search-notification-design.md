# Global Search Notification System — Design

## Summary

When users search, they're navigated to the results page where a radar loading screen tracks progress. However, the MinMax AI agent takes 30-90 seconds to complete (up to 8 rounds of LLM + web_search/web_fetch tool calls). Users feel uncertain whether the system is working. 

**Solution**: Keep users on the home page, show real-time progress via a **center notification** and a **global status bar** in the header. Users can navigate freely while the search runs in the background. When complete, a "View Results" button appears instead of auto-navigating.

## Decisions Made (Brainstorming)

1. **Stay on home page** — don't auto-navigate to results page on search
2. **Global status bar** — top-right, persists across all pages (home, history, etc.)
3. **Center notification** — shows on home page with phase-by-phase progress
4. **"View Results" button** — replaces auto-navigation; appears when search completes
5. **Free navigation** — users can browse history or other pages while waiting

## Architecture

### New Files
- `stores/search-notification-store.ts` — Global Zustand store for active search state
- `hooks/useGlobalSearchStream.ts` — Hook that manages SSE connection at layout level
- `components/shared/GlobalSearchStatus.tsx` — Status pill in the header (top-right)
- `components/search/SearchProgressNotification.tsx` — Center notification on home page

### Modified Files
- `app/layout.tsx` — Add GlobalSearchProvider wrapper
- `components/shared/Header.tsx` — Include GlobalSearchStatus component
- `app/page.tsx` — Replace auto-navigation with center notification; connect to global store
- `app/scout/[id]/ScoutResultsClient.tsx` — Support loading from global store (no SSE re-connect)
- `app/globals.css` — New animations for the notification components

### Data Flow

```
User clicks Search
  → POST /api/scout → get { id, mode }
  → Store searchId + query in search-notification-store
  → Start SSE via useGlobalSearchStream (in layout)
  → GlobalSearchStatus (header) shows progress pill
  → SearchProgressNotification (home page) shows center status
  → User can navigate freely (status bar follows)
  → On phase1_complete → show "View Results" button
  → Click → navigate to /scout/{id} → load from Supabase (saved results)
```

## Open Questions

None — user confirmed all key decisions during brainstorming.
