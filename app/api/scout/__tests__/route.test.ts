import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Stub env vars before any module imports that call requireEnv()
// ---------------------------------------------------------------------------
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk-test");
vi.stubEnv("SUPABASE_SECRET_KEY", "sk-test");
vi.stubEnv("MINIMAX_API_KEY", "test-key");
vi.stubEnv("SERPER_API_KEY", "test-key");

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// -- @/lib/llm
vi.mock("@/lib/llm", () => ({
  callLLMWithTools: vi.fn().mockResolvedValue('{"repos":[]}'),
}));

// -- @/lib/supabase
// Build a chainable mock that mirrors the Supabase query builder pattern.
function createChainableMock(terminal: Record<string, unknown> = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "from",
    "select",
    "insert",
    "update",
    "eq",
    "gte",
    "order",
    "limit",
    "single",
  ];
  for (const m of methods) {
    chain[m] = vi.fn();
  }
  // Every method returns the chain itself, except `single` which resolves.
  for (const m of methods) {
    if (m === "single") {
      chain[m].mockReturnValue(
        Promise.resolve({ data: null, error: null, ...terminal })
      );
    } else {
      chain[m].mockReturnValue(chain);
    }
  }
  // insert also needs to resolve for the "persist to Supabase" path
  chain.insert.mockReturnValue(Promise.resolve({ data: null, error: null }));
  return chain;
}

const mockSupabaseChain = createChainableMock();

vi.mock("@/lib/supabase", () => ({
  createServerClient: vi.fn(() => mockSupabaseChain),
  getSessionUserIdFromAuth: vi.fn().mockResolvedValue({
    userId: "test-user",
    isAuthenticated: true,
  }),
}));

// -- @/lib/supabase/server
vi.mock("@/lib/supabase/server", () => ({
  createAuthServerClient: vi.fn().mockResolvedValue({}),
}));

// -- @/lib/rate-limit
vi.mock("@/lib/rate-limit", () => ({
  checkAnonymousRateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 1 }),
}));

// -- @/lib/auth
vi.mock("@/lib/auth", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

// -- @/lib/deep-dive-analyzer-v2
vi.mock("@/lib/deep-dive-analyzer-v2", () => ({
  analyzeReposV2Batch: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Import handler under test (AFTER mocks are declared)
// ---------------------------------------------------------------------------
import { POST } from "../route";
import { getSessionUserIdFromAuth } from "@/lib/supabase";
import { checkAnonymousRateLimit } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3333/api/scout", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/scout", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-apply default mock returns after clearAllMocks
    vi.mocked(getSessionUserIdFromAuth).mockResolvedValue({
      userId: "test-user",
      isAuthenticated: true,
    });

    vi.mocked(checkAnonymousRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 1,
    });

    // Reset chainable mock returns
    for (const m of [
      "from",
      "select",
      "insert",
      "update",
      "eq",
      "gte",
      "order",
      "limit",
    ]) {
      mockSupabaseChain[m].mockReturnValue(mockSupabaseChain);
    }
    mockSupabaseChain.single.mockReturnValue(
      Promise.resolve({ data: null, error: null })
    );
    mockSupabaseChain.insert.mockReturnValue(
      Promise.resolve({ data: null, error: null })
    );
  });

  // -----------------------------------------------------------------------
  // 1. Missing / short query (< 3 chars)
  // -----------------------------------------------------------------------
  it("returns 400 when query is too short (< 3 characters)", async () => {
    const req = makeRequest({ query: "ab" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Query must be 3-200 characters");
  });

  it("returns 400 when query is only whitespace under 3 chars", async () => {
    const req = makeRequest({ query: "  a " });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Query must be 3-200 characters");
  });

  // -----------------------------------------------------------------------
  // 2. Long query (> 200 chars)
  // -----------------------------------------------------------------------
  it("returns 400 when query exceeds 200 characters", async () => {
    const longQuery = "a".repeat(201);
    const req = makeRequest({ query: longQuery });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Query must be 3-200 characters");
  });

  // -----------------------------------------------------------------------
  // 3. Missing query field
  // -----------------------------------------------------------------------
  it("returns 400 when query field is missing", async () => {
    const req = makeRequest({ mode: "SCOUT" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Query must be 3-200 characters");
  });

  it("returns 400 when query is an empty string", async () => {
    const req = makeRequest({ query: "" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Query must be 3-200 characters");
  });

  // -----------------------------------------------------------------------
  // 4. Happy path — returns { id, mode } with valid UUID
  // -----------------------------------------------------------------------
  it("returns 200 with id (valid UUID) and mode on valid query", async () => {
    const req = makeRequest({ query: "react state management" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    // Should have a UUID-format id
    expect(json.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    // Mode should be a valid ScoutMode
    expect(["LEARN", "BUILD", "SCOUT"]).toContain(json.mode);
  });

  it("respects explicitly provided mode", async () => {
    const req = makeRequest({ query: "graphql libraries", mode: "BUILD" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe("BUILD");
  });

  // -----------------------------------------------------------------------
  // 5. Rate limit hit for anonymous user — returns 429
  // -----------------------------------------------------------------------
  it("returns 429 when anonymous user hits rate limit", async () => {
    // Make user anonymous (not authenticated)
    vi.mocked(getSessionUserIdFromAuth).mockResolvedValueOnce({
      userId: "anonymous-session-id",
      isAuthenticated: false,
    });

    // Rate limit exceeded
    vi.mocked(checkAnonymousRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
    });

    const req = makeRequest({ query: "test query here" });
    const res = await POST(req);

    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe("rate_limited");
    expect(json.remaining).toBe(0);
    expect(json.message).toMatch(/sign in/i);
  });

  it("does not rate-limit authenticated users", async () => {
    // User is authenticated — rate limit should NOT be checked
    vi.mocked(getSessionUserIdFromAuth).mockResolvedValueOnce({
      userId: "auth-user-123",
      isAuthenticated: true,
    });

    const req = makeRequest({ query: "test query here" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(checkAnonymousRateLimit).not.toHaveBeenCalled();
  });
});
