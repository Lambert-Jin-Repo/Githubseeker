import { NextRequest, NextResponse } from "next/server";
import type { SearchHistoryItem } from "@/lib/types";

// In-memory storage keyed by session ID (temporary until Supabase is connected)
const historyStore = new Map<string, SearchHistoryItem[]>();

const SESSION_COOKIE_NAME = "github_scout_session";
const MAX_HISTORY_ITEMS = 20;

function getSessionId(request: NextRequest): string | null {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME);
  return cookie?.value ?? null;
}

/** GET /api/history — Return recent searches for the current session */
export async function GET(request: NextRequest) {
  const sessionId = getSessionId(request);

  if (!sessionId) {
    return NextResponse.json({ items: [] });
  }

  const items = historyStore.get(sessionId) ?? [];

  // Return most recent first, limited to MAX_HISTORY_ITEMS
  const sorted = [...items]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, MAX_HISTORY_ITEMS);

  return NextResponse.json({ items: sorted });
}

/** POST /api/history — Add a search to history */
export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);

    if (!sessionId) {
      return NextResponse.json(
        { error: "No session found" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { id, query, mode, repos_found, phase2_complete } = body;

    if (!id || !query || !mode) {
      return NextResponse.json(
        { error: "id, query, and mode are required" },
        { status: 400 }
      );
    }

    const item: SearchHistoryItem = {
      id,
      query,
      mode,
      repos_found: repos_found ?? 0,
      created_at: new Date().toISOString(),
      phase2_complete: phase2_complete ?? false,
    };

    const existing = historyStore.get(sessionId) ?? [];

    // Prevent duplicate entries by search ID
    const filtered = existing.filter((h) => h.id !== id);
    filtered.unshift(item);

    // Cap at MAX_HISTORY_ITEMS
    historyStore.set(sessionId, filtered.slice(0, MAX_HISTORY_ITEMS));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
