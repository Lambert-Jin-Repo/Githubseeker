import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @supabase/ssr before any imports
const mockClient = {
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => mockClient),
}));

// Stub env vars
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk-test-key");

describe("createBrowserClient", () => {
  beforeEach(() => {
    // Reset the module to clear the singleton between tests
    vi.resetModules();
  });

  it("returns a client with auth methods", async () => {
    const { createBrowserClient } = await import("../supabase/client");
    const client = createBrowserClient();

    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
    expect(client.auth.getUser).toBeDefined();
    expect(client.auth.signOut).toBeDefined();
    expect(client.auth.onAuthStateChange).toBeDefined();
  });

  it("returns the same instance on subsequent calls (singleton)", async () => {
    const { createBrowserClient } = await import("../supabase/client");
    const client1 = createBrowserClient();
    const client2 = createBrowserClient();

    expect(client1).toBe(client2);
  });

  it("calls @supabase/ssr createBrowserClient with correct params", async () => {
    const { createBrowserClient: ssrCreate } = await import("@supabase/ssr");
    const { createBrowserClient } = await import("../supabase/client");

    createBrowserClient();

    expect(ssrCreate).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "pk-test-key"
    );
  });
});
