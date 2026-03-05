import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock env vars before importing
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk-test-key");
vi.stubEnv("SUPABASE_SECRET_KEY", "sk-test-key");

// Build a mock client that supports .from().insert()
function buildMockClient(insertResult: { data: unknown; error: unknown }) {
  const thenFn = vi.fn((cb: (result: any) => void) => {
    cb(insertResult);
    return { catch: vi.fn() };
  });
  const insertFn = vi.fn().mockReturnValue({ then: thenFn });
  const fromFn = vi.fn().mockReturnValue({ insert: insertFn });
  const mockClient = { from: fromFn };
  return { mockClient, fromFn, insertFn, thenFn };
}

describe("calculateLLMCost", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("calculates cost for MiniMax M2.5", async () => {
    vi.doMock("../supabase", () => ({
      createServerClient: () => ({}),
    }));

    const { calculateLLMCost } = await import("../api-logger");

    // MiniMax: $0.30/1M input, $1.20/1M output
    // 1000 input tokens = 1000 * 0.30 / 1_000_000 = 0.0003
    // 500 output tokens = 500 * 1.20 / 1_000_000 = 0.0006
    // Total = 0.0009
    const cost = calculateLLMCost("minimax", 1000, 500);
    expect(cost).toBeCloseTo(0.0009, 6);
  });

  it("calculates cost for OpenAI gpt-4o-mini", async () => {
    vi.doMock("../supabase", () => ({
      createServerClient: () => ({}),
    }));

    const { calculateLLMCost } = await import("../api-logger");

    // OpenAI: $0.15/1M input, $0.60/1M output
    // 2000 input = 2000 * 0.15 / 1_000_000 = 0.0003
    // 1000 output = 1000 * 0.60 / 1_000_000 = 0.0006
    // Total = 0.0009
    const cost = calculateLLMCost("openai", 2000, 1000);
    expect(cost).toBeCloseTo(0.0009, 6);
  });

  it("calculates cost for DeepSeek", async () => {
    vi.doMock("../supabase", () => ({
      createServerClient: () => ({}),
    }));

    const { calculateLLMCost } = await import("../api-logger");

    // DeepSeek: $0.14/1M input, $0.28/1M output
    // 1000 input = 1000 * 0.14 / 1_000_000 = 0.00014
    // 1000 output = 1000 * 0.28 / 1_000_000 = 0.00028
    // Total = 0.00042
    const cost = calculateLLMCost("deepseek", 1000, 1000);
    expect(cost).toBeCloseTo(0.00042, 6);
  });

  it("returns 0 for unknown provider", async () => {
    vi.doMock("../supabase", () => ({
      createServerClient: () => ({}),
    }));

    const { calculateLLMCost } = await import("../api-logger");
    const cost = calculateLLMCost("unknown-provider", 1000, 500);
    expect(cost).toBe(0);
  });

  it("returns 0 for zero tokens", async () => {
    vi.doMock("../supabase", () => ({
      createServerClient: () => ({}),
    }));

    const { calculateLLMCost } = await import("../api-logger");
    const cost = calculateLLMCost("minimax", 0, 0);
    expect(cost).toBe(0);
  });
});

describe("logLLMCall", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("inserts correct fields including cost_usd > 0", async () => {
    const { mockClient, fromFn, insertFn } = buildMockClient({
      data: null,
      error: null,
    });

    vi.doMock("../supabase", () => ({
      createServerClient: () => mockClient,
    }));

    const { logLLMCall } = await import("../api-logger");

    logLLMCall({
      search_id: "search-123",
      provider: "minimax",
      model: "MiniMax-M1",
      operation: "scout_search",
      success: true,
      latency_ms: 1200,
      tokens_in: 1000,
      tokens_out: 500,
      tool_round: 1,
    });

    // Wait for the fire-and-forget promise to resolve
    await vi.waitFor(() => {
      expect(fromFn).toHaveBeenCalledWith("api_usage_logs");
    });

    const insertedRow = insertFn.mock.calls[0][0];
    expect(insertedRow.search_id).toBe("search-123");
    expect(insertedRow.provider).toBe("minimax");
    expect(insertedRow.model).toBe("MiniMax-M1");
    expect(insertedRow.operation).toBe("scout_search");
    expect(insertedRow.success).toBe(true);
    expect(insertedRow.latency_ms).toBe(1200);
    expect(insertedRow.tokens_in).toBe(1000);
    expect(insertedRow.tokens_out).toBe(500);
    expect(insertedRow.tool_round).toBe(1);
    expect(insertedRow.cost_usd).toBeGreaterThan(0);
    // MiniMax cost: 1000 * 0.30/1M + 500 * 1.20/1M = 0.0009
    expect(insertedRow.cost_usd).toBeCloseTo(0.0009, 6);
  });

  it("includes error_type when provided", async () => {
    const { mockClient, insertFn } = buildMockClient({
      data: null,
      error: null,
    });

    vi.doMock("../supabase", () => ({
      createServerClient: () => mockClient,
    }));

    const { logLLMCall } = await import("../api-logger");

    logLLMCall({
      search_id: "search-456",
      provider: "minimax",
      model: "MiniMax-M1",
      operation: "deep_dive",
      success: false,
      latency_ms: 5000,
      tokens_in: 0,
      tokens_out: 0,
      error_type: "timeout",
    });

    await vi.waitFor(() => {
      expect(insertFn).toHaveBeenCalled();
    });

    const insertedRow = insertFn.mock.calls[0][0];
    expect(insertedRow.success).toBe(false);
    expect(insertedRow.error_type).toBe("timeout");
    expect(insertedRow.cost_usd).toBe(0);
  });

  it("does not throw when insert fails", async () => {
    const { mockClient } = buildMockClient({
      data: null,
      error: { message: "DB error" },
    });

    vi.doMock("../supabase", () => ({
      createServerClient: () => mockClient,
    }));

    const { logLLMCall } = await import("../api-logger");

    // Should not throw
    expect(() =>
      logLLMCall({
        search_id: "search-789",
        provider: "minimax",
        model: "MiniMax-M1",
        operation: "scout_search",
        success: true,
        latency_ms: 1000,
        tokens_in: 100,
        tokens_out: 50,
      })
    ).not.toThrow();
  });

  it("does not throw when createServerClient throws", async () => {
    vi.doMock("../supabase", () => ({
      createServerClient: () => {
        throw new Error("Missing env var");
      },
    }));

    const { logLLMCall } = await import("../api-logger");

    expect(() =>
      logLLMCall({
        search_id: "search-err",
        provider: "minimax",
        model: "MiniMax-M1",
        operation: "scout_search",
        success: true,
        latency_ms: 1000,
        tokens_in: 100,
        tokens_out: 50,
      })
    ).not.toThrow();
  });
});

describe("logSerperCall", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("inserts with provider 'serper' and correct cost", async () => {
    const { mockClient, fromFn, insertFn } = buildMockClient({
      data: null,
      error: null,
    });

    vi.doMock("../supabase", () => ({
      createServerClient: () => mockClient,
    }));

    const { logSerperCall } = await import("../api-logger");

    logSerperCall({
      search_id: "search-serper-1",
      success: true,
      latency_ms: 350,
      query: "best react frameworks",
    });

    await vi.waitFor(() => {
      expect(fromFn).toHaveBeenCalledWith("api_usage_logs");
    });

    const insertedRow = insertFn.mock.calls[0][0];
    expect(insertedRow.provider).toBe("serper");
    expect(insertedRow.operation).toBe("web_search");
    expect(insertedRow.success).toBe(true);
    expect(insertedRow.latency_ms).toBe(350);
    // $1.00/1K queries = $0.001 per query
    expect(insertedRow.cost_usd).toBeCloseTo(0.001, 6);
    expect(insertedRow.search_id).toBe("search-serper-1");
    expect(insertedRow.metadata).toEqual({ query: "best react frameworks" });
  });

  it("does not throw on error", async () => {
    vi.doMock("../supabase", () => ({
      createServerClient: () => {
        throw new Error("Missing env");
      },
    }));

    const { logSerperCall } = await import("../api-logger");

    expect(() =>
      logSerperCall({
        search_id: "search-serper-err",
        success: false,
        latency_ms: 0,
        error_type: "network_error",
      })
    ).not.toThrow();
  });
});

describe("logGitHubFetch", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("inserts with provider 'github' and cost 0", async () => {
    const { mockClient, fromFn, insertFn } = buildMockClient({
      data: null,
      error: null,
    });

    vi.doMock("../supabase", () => ({
      createServerClient: () => mockClient,
    }));

    const { logGitHubFetch } = await import("../api-logger");

    logGitHubFetch({
      search_id: "search-gh-1",
      success: true,
      latency_ms: 200,
      url: "https://github.com/vercel/next.js",
    });

    await vi.waitFor(() => {
      expect(fromFn).toHaveBeenCalledWith("api_usage_logs");
    });

    const insertedRow = insertFn.mock.calls[0][0];
    expect(insertedRow.provider).toBe("github");
    expect(insertedRow.operation).toBe("web_fetch");
    expect(insertedRow.success).toBe(true);
    expect(insertedRow.latency_ms).toBe(200);
    expect(insertedRow.cost_usd).toBe(0);
    expect(insertedRow.search_id).toBe("search-gh-1");
    expect(insertedRow.metadata).toEqual({
      url: "https://github.com/vercel/next.js",
    });
  });

  it("does not throw on error", async () => {
    vi.doMock("../supabase", () => ({
      createServerClient: () => {
        throw new Error("Missing env");
      },
    }));

    const { logGitHubFetch } = await import("../api-logger");

    expect(() =>
      logGitHubFetch({
        search_id: "search-gh-err",
        success: false,
        latency_ms: 0,
        error_type: "fetch_error",
        url: "https://github.com/fail/repo",
      })
    ).not.toThrow();
  });
});
