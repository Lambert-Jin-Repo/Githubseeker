import { describe, it, expect, vi } from "vitest";

// Mock env vars before importing
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk-test-key");
vi.stubEnv("SUPABASE_SECRET_KEY", "sk-test-key");

describe("getSessionUserId", () => {
  it("extracts user_id from github_scout_session cookie", async () => {
    const { getSessionUserId } = await import("../supabase");
    const request = {
      cookies: {
        get: (name: string) =>
          name === "github_scout_session"
            ? { value: "550e8400-e29b-41d4-a716-446655440000" }
            : undefined,
      },
    } as any;

    const userId = getSessionUserId(request);
    expect(userId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("returns 'anonymous' when no session cookie", async () => {
    const { getSessionUserId } = await import("../supabase");
    const request = {
      cookies: {
        get: () => undefined,
      },
    } as any;

    const userId = getSessionUserId(request);
    expect(userId).toBe("anonymous");
  });

  it("returns 'anonymous' when cookie value is invalid UUID", async () => {
    const { getSessionUserId } = await import("../supabase");
    const request = {
      cookies: {
        get: (name: string) =>
          name === "github_scout_session"
            ? { value: "not-a-valid-uuid" }
            : undefined,
      },
    } as any;

    const userId = getSessionUserId(request);
    expect(userId).toBe("anonymous");
  });
});

describe("getSessionUserIdFromAuth", () => {
  it("returns auth user ID when Supabase session exists", async () => {
    const { getSessionUserIdFromAuth } = await import("../supabase");
    const request = {
      cookies: {
        get: () => undefined,
      },
    } as any;

    const authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "auth-user-abc-123" } },
          error: null,
        }),
      },
    } as any;

    const result = await getSessionUserIdFromAuth(request, authClient);
    expect(result.userId).toBe("auth-user-abc-123");
    expect(result.isAuthenticated).toBe(true);
  });

  it("falls back to cookie when no auth session", async () => {
    const { getSessionUserIdFromAuth } = await import("../supabase");
    const request = {
      cookies: {
        get: (name: string) =>
          name === "github_scout_session"
            ? { value: "550e8400-e29b-41d4-a716-446655440000" }
            : undefined,
      },
    } as any;

    const authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "No session" },
        }),
      },
    } as any;

    const result = await getSessionUserIdFromAuth(request, authClient);
    expect(result.userId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(result.isAuthenticated).toBe(false);
  });

  it("falls back to 'anonymous' when auth fails and no cookie", async () => {
    const { getSessionUserIdFromAuth } = await import("../supabase");
    const request = {
      cookies: {
        get: () => undefined,
      },
    } as any;

    const authClient = {
      auth: {
        getUser: vi.fn().mockRejectedValue(new Error("Network error")),
      },
    } as any;

    const result = await getSessionUserIdFromAuth(request, authClient);
    expect(result.userId).toBe("anonymous");
    expect(result.isAuthenticated).toBe(false);
  });
});
