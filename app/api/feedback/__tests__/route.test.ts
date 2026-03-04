import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Stub env vars before any imports that read them
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk-test");
vi.stubEnv("SUPABASE_SECRET_KEY", "sk-test");

// --- Supabase mocks ---

const mockSingle = vi.fn();
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockUpsert = vi.fn();
const mockFrom = vi.fn((table: string) => {
  if (table === "searches") {
    return {
      select: mockSelect,
    };
  }
  if (table === "feedback") {
    return {
      upsert: mockUpsert,
    };
  }
  return {};
});

vi.mock("@/lib/supabase", () => ({
  createServerClient: () => ({ from: mockFrom }),
  getSessionUserIdFromAuth: vi.fn().mockResolvedValue({
    userId: "test-user",
    isAuthenticated: true,
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAuthServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn() },
  }),
}));

// Import POST after mocks are set up
import { POST } from "../route";

// --- Helpers ---

const VALID_SEARCH_ID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_REPO_URL = "https://github.com/vercel/next.js";

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3333/api/feedback", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: .eq().eq().single() returns a found search
    mockEq.mockReturnThis();
    mockEq.mockImplementation(function (this: unknown) {
      return {
        eq: mockEq,
        single: mockSingle,
      };
    });
    mockSingle.mockResolvedValue({
      data: { id: VALID_SEARCH_ID },
      error: null,
    });

    // Default: upsert succeeds
    mockUpsert.mockResolvedValue({ error: null });
  });

  // --------------------------------------------------
  // 1. Missing search_id
  // --------------------------------------------------
  it("returns 400 when search_id is missing", async () => {
    const req = makeRequest({
      repo_url: VALID_REPO_URL,
      signal: "useful",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("search_id is required");
  });

  // --------------------------------------------------
  // 2. Invalid UUID for search_id
  // --------------------------------------------------
  it("returns 400 when search_id is not a valid UUID", async () => {
    const req = makeRequest({
      search_id: "not-a-uuid",
      repo_url: VALID_REPO_URL,
      signal: "useful",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("search_id must be a valid UUID");
  });

  // --------------------------------------------------
  // 3. Invalid signal value
  // --------------------------------------------------
  it("returns 400 when signal is invalid", async () => {
    const req = makeRequest({
      search_id: VALID_SEARCH_ID,
      repo_url: VALID_REPO_URL,
      signal: "bad_signal",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe(
      "signal must be one of: useful, not_useful, inaccurate"
    );
  });

  // --------------------------------------------------
  // 4. Missing repo_url
  // --------------------------------------------------
  it("returns 400 when repo_url is missing", async () => {
    const req = makeRequest({
      search_id: VALID_SEARCH_ID,
      signal: "useful",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("repo_url is required");
  });

  // --------------------------------------------------
  // 5. Invalid repo_url (not GitHub)
  // --------------------------------------------------
  it("returns 400 when repo_url is not a GitHub URL", async () => {
    const req = makeRequest({
      search_id: VALID_SEARCH_ID,
      repo_url: "https://gitlab.com/some/repo",
      signal: "useful",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("repo_url must be a GitHub URL");
  });

  // --------------------------------------------------
  // 6. Search not found (auth check fails)
  // --------------------------------------------------
  it("returns 404 when search is not found for the user", async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });

    const req = makeRequest({
      search_id: VALID_SEARCH_ID,
      repo_url: VALID_REPO_URL,
      signal: "useful",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Search not found");
  });

  // --------------------------------------------------
  // 7. Happy path
  // --------------------------------------------------
  it("returns 200 with { success: true } on valid feedback", async () => {
    const req = makeRequest({
      search_id: VALID_SEARCH_ID,
      repo_url: VALID_REPO_URL,
      signal: "useful",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true });
    expect(mockFrom).toHaveBeenCalledWith("searches");
    expect(mockFrom).toHaveBeenCalledWith("feedback");
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        search_id: VALID_SEARCH_ID,
        repo_url: VALID_REPO_URL,
        signal: "useful",
      },
      { onConflict: "search_id,repo_url,signal" }
    );
  });

  // --------------------------------------------------
  // 8. Supabase error on upsert
  // --------------------------------------------------
  it("returns 500 when Supabase upsert fails", async () => {
    mockUpsert.mockResolvedValue({
      error: { message: "DB connection lost" },
    });

    const req = makeRequest({
      search_id: VALID_SEARCH_ID,
      repo_url: VALID_REPO_URL,
      signal: "not_useful",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to save feedback");
  });
});
