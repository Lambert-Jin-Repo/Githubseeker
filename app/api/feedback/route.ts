import { NextRequest, NextResponse } from "next/server";
import type { FeedbackSignal } from "@/lib/types";
import { createServerClient } from "@/lib/supabase";

const VALID_SIGNALS: FeedbackSignal[] = ["useful", "not_useful", "inaccurate"];

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

    if (!repo_url || typeof repo_url !== "string") {
      return NextResponse.json(
        { error: "repo_url is required" },
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

    // Persist to Supabase
    const db = createServerClient();
    const { error: dbError } = await db.from("feedback").insert({
      search_id,
      repo_url,
      signal,
      ...(comment ? { comment } : {}),
    });

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
