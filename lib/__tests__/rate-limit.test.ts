import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock env vars before importing
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk-test-key");
vi.stubEnv("SUPABASE_SECRET_KEY", "sk-test-key");

// Build a mock client that supports the .rpc() call
function buildMockClient(rpcResult: { data: unknown; error: unknown }) {
  const rpcFn = vi.fn().mockResolvedValue(rpcResult);
  const mockClient = { rpc: rpcFn };
  return { mockClient, rpcFn };
}

describe("checkAnonymousRateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("allows first search from a new IP", async () => {
    const { mockClient, rpcFn } = buildMockClient({
      data: [{ allowed: true, remaining: 1 }],
      error: null,
    });

    vi.doMock("../supabase", () => ({
      createServerClient: () => mockClient,
    }));

    const { checkAnonymousRateLimit } = await import("../rate-limit");
    const result = await checkAnonymousRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
    expect(rpcFn).toHaveBeenCalledWith("check_and_increment_rate_limit", {
      p_ip: "192.168.1.1",
      p_limit: 2,
      p_window_hours: 24,
    });
  });

  it("blocks when limit exceeded", async () => {
    const { mockClient } = buildMockClient({
      data: [{ allowed: false, remaining: 0 }],
      error: null,
    });

    vi.doMock("../supabase", () => ({
      createServerClient: () => mockClient,
    }));

    const { checkAnonymousRateLimit } = await import("../rate-limit");
    const result = await checkAnonymousRateLimit("192.168.1.1");

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("allows when under limit with correct remaining", async () => {
    const { mockClient } = buildMockClient({
      data: [{ allowed: true, remaining: 0 }],
      error: null,
    });

    vi.doMock("../supabase", () => ({
      createServerClient: () => mockClient,
    }));

    const { checkAnonymousRateLimit } = await import("../rate-limit");
    const result = await checkAnonymousRateLimit("10.0.0.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("fails open on RPC error", async () => {
    const { mockClient } = buildMockClient({
      data: null,
      error: { message: "RPC not found" },
    });

    vi.doMock("../supabase", () => ({
      createServerClient: () => mockClient,
    }));

    const { checkAnonymousRateLimit } = await import("../rate-limit");
    const result = await checkAnonymousRateLimit("10.0.0.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });
});
