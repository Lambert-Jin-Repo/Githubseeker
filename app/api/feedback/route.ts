import { NextRequest, NextResponse } from "next/server";
import type { FeedbackSignal } from "@/lib/types";
import { createServerClient, getSessionUserIdFromAuth } from "@/lib/supabase";
import { createAuthServerClient } from "@/lib/supabase/server";

const VALID_SIGNALS: FeedbackSignal[] = ["useful", "not_useful", "inaccurate"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_COMMENT_LENGTH = 2000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { search_id, repo_url, signal, comment } = body;

    if (!search_id || typeof search_id !== "string") {
      return NextResponse.json(
        { error: "search_id is required" },
        { status: 400 }
      );
    }

    if (!UUID_RE.test(search_id)) {
      return NextResponse.json(
        { error: "search_id must be a valid UUID" },
        { status: 400 }
      );
    }

    if (!repo_url || typeof repo_url !== "string") {
      return NextResponse.json(
        { error: "repo_url is required" },
        { status: 400 }
      );
    }

    if (!repo_url.startsWith("https://github.com/")) {
      return NextResponse.json(
        { error: "repo_url must be a GitHub URL" },
        { status: 400 }
      );
    }

    if (!signal || !VALID_SIGNALS.includes(signal as FeedbackSignal)) {
      return NextResponse.json(
        { error: "signal must be one of: useful, not_useful, inaccurate" },
        { status: 400 }
      );
    }

    if (comment !== undefined && typeof comment !== "string") {
      return NextResponse.json(
        { error: "comment must be a string" },
        { status: 400 }
      );
    }

    const trimmedComment = typeof comment === "string"
      ? comment.slice(0, MAX_COMMENT_LENGTH)
      : undefined;

    // Auth check: resolve user and verify search belongs to them
    const authClient = await createAuthServerClient();
    const { userId } = await getSessionUserIdFromAuth(request, authClient);
    const db = createServerClient();

    const { data: search } = await db
      .from("searches")
      .select("id")
      .eq("id", search_id)
      .eq("user_id", userId)
      .single();

    if (!search) {
      return NextResponse.json(
        { error: "Search not found" },
        { status: 404 }
      );
    }

    // Persist to Supabase (upsert to deduplicate same signal per search+repo)
    const { error: dbError } = await db.from("feedback").upsert(
      {
        search_id,
        repo_url,
        signal,
        ...(trimmedComment ? { comment: trimmedComment } : {}),
      },
      { onConflict: "search_id,repo_url,signal" }
    );

    if (dbError) {
      console.error("Failed to save feedback:", dbError);
      return NextResponse.json(
        { error: "Failed to save feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
