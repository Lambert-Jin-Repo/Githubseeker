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
