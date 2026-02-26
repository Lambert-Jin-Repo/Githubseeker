import { NextRequest, NextResponse } from "next/server";
import type { FeedbackSignal } from "@/lib/types";

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

    // TODO: Persist to Supabase once schema is ready
    // For now, just acknowledge the feedback
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
