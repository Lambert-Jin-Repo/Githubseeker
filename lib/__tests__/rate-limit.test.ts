import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock env vars before importing
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk-test-key");
vi.stubEnv("SUPABASE_SECRET_KEY", "sk-test-key");

// Build a chainable mock for the Supabase client
function buildMockClient(selectResult: { data: unknown; error: unknown }) {
  const upsertFn = vi.fn().mockResolvedValue({ data: null, error: null });

  const mockClient = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(selectResult),
        }),
      }),
      upsert: upsertFn,
    }),
  };

  return { mockClient, upsertFn };
}

describe("checkAnonymousRateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("allows first search from a new IP and sets count to 1", async () => {
    const { mockClient, upsertFn } = buildMockClient({
      data: null,
      error: { code: "PGRST116", message: "not found" },
    });

    vi.doMock("../supabase", () => ({
      createServerClient: () => mockClient,
    }));

    const { checkAnonymousRateLimit } = await import("../rate-limit");
    const result = await checkAnonymousRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        ip_address: "192.168.1.1",
        search_count: 1,
      }),
      { onConflict: "ip_address" }
    );
  });

  it("blocks when search_count >= 2", async () => {
    const { mockClient, upsertFn } = buildMockClient({
      data: {
        search_count: 2,
        window_start: new Date().toISOString(),
      },
      error: null,
    });

    vi.doMock("../supabase", () => ({
      createServerClient: () => mockClient,
    }));

    const { checkAnonymousRateLimit } = await import("../rate-limit");
    const result = await checkAnonymousRateLimit("192.168.1.1");

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    // Should NOT upsert when blocked
    expect(upsertFn).not.toHaveBeenCalled();
  });

  it("resets window when expired and allows search", async () => {
    const expiredTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
    const { mockClient, upsertFn } = buildMockClient({
      data: {
        search_count: 2,
        window_start: expiredTime,
      },
      error: null,
    });

    vi.doMock("../supabase", () => ({
      createServerClient: () => mockClient,
    }));

    const { checkAnonymousRateLimit } = await import("../rate-limit");
    const result = await checkAnonymousRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        ip_address: "192.168.1.1",
        search_count: 1,
      }),
      { onConflict: "ip_address" }
    );
  });

  it("increments count when under limit", async () => {
    const recentTime = new Date().toISOString();
    const { mockClient, upsertFn } = buildMockClient({
      data: {
        search_count: 1,
        window_start: recentTime,
      },
      error: null,
    });

    vi.doMock("../supabase", () => ({
      createServerClient: () => mockClient,
    }));

    const { checkAnonymousRateLimit } = await import("../rate-limit");
    const result = await checkAnonymousRateLimit("10.0.0.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        ip_address: "10.0.0.1",
        search_count: 2,
        window_start: recentTime,
      }),
      { onConflict: "ip_address" }
    );
  });
});
