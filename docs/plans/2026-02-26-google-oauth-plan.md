# Google OAuth & Rate Limiting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Google login via Supabase Auth so authenticated users get persistent search history across devices, while anonymous users are rate-limited to 2 searches per 24h (cookie + IP).

**Architecture:** Replace the custom UUID cookie session with Supabase Auth (`@supabase/ssr`). Middleware refreshes auth tokens on every request. API routes use `getUser()`/`getClaims()` for authenticated users, falling back to cookie UUID for anonymous. A `rate_limits` table enforces IP-based limits for anonymous users.

**Tech Stack:** `@supabase/ssr`, Supabase Auth (Google provider, PKCE), Next.js 16 App Router middleware, Vitest

**Design Doc:** `docs/plans/2026-02-26-google-oauth-design.md`

---

### Task 1: Install `@supabase/ssr` dependency

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run: `npm install @supabase/ssr`

**Step 2: Verify installation**

Run: `npm ls @supabase/ssr`
Expected: Shows `@supabase/ssr@x.x.x`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @supabase/ssr for auth session handling"
```

---

### Task 2: Create Supabase SSR browser client

**Files:**
- Create: `lib/supabase/client.ts`
- Test: `lib/__tests__/supabase-client.test.ts`

**Step 1: Write the failing test**

Create `lib/__tests__/supabase-client.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk-test-key");

describe("createBrowserClient", () => {
  it("returns a Supabase client with auth methods", async () => {
    const { createBrowserClient } = await import("../supabase/client");
    const client = createBrowserClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
    expect(typeof client.auth.signInWithOAuth).toBe("function");
    expect(typeof client.auth.signOut).toBe("function");
    expect(typeof client.auth.getUser).toBe("function");
  });

  it("returns the same instance on multiple calls (singleton)", async () => {
    const { createBrowserClient } = await import("../supabase/client");
    const a = createBrowserClient();
    const b = createBrowserClient();
    expect(a).toBe(b);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/supabase-client.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `lib/supabase/client.ts`:

```typescript
import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";

let _client: ReturnType<typeof _createBrowserClient> | null = null;

export function createBrowserClient() {
  if (_client) return _client;
  _client = _createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
  return _client;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/supabase-client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/supabase/client.ts lib/__tests__/supabase-client.test.ts
git commit -m "feat(auth): add Supabase SSR browser client"
```

---

### Task 3: Create Supabase SSR server client

**Files:**
- Create: `lib/supabase/server.ts`

**Step 1: Write the implementation**

Create `lib/supabase/server.ts`:

```typescript
import { createServerClient as _createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createAuthServerClient() {
  const cookieStore = await cookies();

  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — safe to ignore
            // if middleware is refreshing sessions.
          }
        },
      },
    }
  );
}
```

Note: This is separate from the existing `createServerClient()` in `lib/supabase.ts` which uses the service role key. The new one uses the publishable key + user cookies for auth-scoped access. The old one stays for background operations.

**Step 2: Verify the project still builds**

Run: `npx next build` (or `npm run build`)
Expected: Build succeeds (no syntax errors)

**Step 3: Commit**

```bash
git add lib/supabase/server.ts
git commit -m "feat(auth): add Supabase SSR server client with cookie handling"
```

---

### Task 4: Create auth middleware for session refresh

**Files:**
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts` (project root)

**Step 1: Write the middleware helper**

Create `lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — MUST be called immediately after createServerClient.
  // Uses getClaims() which validates JWT signature (secure, not spoofable).
  await supabase.auth.getUser();

  return supabaseResponse;
}
```

**Step 2: Write the Next.js middleware entry point**

Create `middleware.ts` at project root:

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on all paths EXCEPT static assets and images
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Step 3: Test locally**

Run: `npm run dev -- -p 3333`
Visit: `http://localhost:3333`
Expected: App loads normally. No errors in terminal. The middleware runs silently (no auth session yet).

**Step 4: Commit**

```bash
git add lib/supabase/middleware.ts middleware.ts
git commit -m "feat(auth): add Next.js middleware for Supabase session refresh"
```

---

### Task 5: Create auth callback route (PKCE code exchange)

**Files:**
- Create: `app/auth/callback/route.ts`

**Step 1: Write the callback handler**

Create `app/auth/callback/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/";

  // Guard against open redirect
  if (!next.startsWith("/")) {
    next = "/";
  }

  if (code) {
    const supabase = await createAuthServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Code missing or exchange failed
  return NextResponse.redirect(`${origin}/?auth_error=true`);
}
```

**Step 2: Commit**

```bash
git add app/auth/callback/route.ts
git commit -m "feat(auth): add PKCE callback route for OAuth code exchange"
```

---

### Task 6: Create provider-agnostic auth utilities and useAuth hook

**Files:**
- Create: `lib/auth.ts`
- Test: `lib/__tests__/auth.test.ts`

**Step 1: Write the failing test**

Create `lib/__tests__/auth.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { OAuthProvider } from "../auth";

describe("auth types", () => {
  it("OAuthProvider includes google, github, azure", async () => {
    // Type-level check: this compiles if the union is correct
    const providers: OAuthProvider[] = ["google", "github", "azure"];
    expect(providers).toHaveLength(3);
  });
});

describe("getClientIp", () => {
  it("extracts IP from x-forwarded-for header", async () => {
    const { getClientIp } = await import("../auth");
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("returns 'unknown' when no IP headers present", async () => {
    const { getClientIp } = await import("../auth");
    const headers = new Headers();
    expect(getClientIp(headers)).toBe("unknown");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/auth.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `lib/auth.ts`:

```typescript
export type OAuthProvider = "google" | "github" | "azure";

/**
 * Extract client IP from request headers.
 * Works with Vercel, Cloudflare, and standard proxies.
 */
export function getClientIp(headers: Headers): string {
  // Vercel
  const xForwardedFor = headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }

  // Cloudflare
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  // Standard
  const xRealIp = headers.get("x-real-ip");
  if (xRealIp) return xRealIp;

  return "unknown";
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/auth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/auth.ts lib/__tests__/auth.test.ts
git commit -m "feat(auth): add provider-agnostic auth utilities and IP extraction"
```

---

### Task 7: Create useAuth React hook

**Files:**
- Create: `hooks/useAuth.ts`

**Step 1: Write the hook**

Create `hooks/useAuth.ts`:

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { OAuthProvider } from "@/lib/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();

    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (provider: OAuthProvider) => {
    const supabase = createBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return { user, loading, signIn, signOut };
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add hooks/useAuth.ts
git commit -m "feat(auth): add useAuth hook with signIn/signOut and state listener"
```

---

### Task 8: Create rate_limits table in Supabase

**Files:**
- The migration runs in Supabase, not local files

**Step 1: Apply the migration**

Use the Supabase MCP tool `apply_migration` with project_id `fnylozxqgmnzvdbshzvn`:

```sql
-- Rate limiting for anonymous users
CREATE TABLE rate_limits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address text NOT NULL,
  search_count integer DEFAULT 0,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_rate_limits_ip ON rate_limits (ip_address);

-- No RLS needed — only accessed by service role client
```

**Step 2: Verify table exists**

Run SQL: `SELECT * FROM rate_limits LIMIT 1;`
Expected: Empty result set (no error)

**Step 3: Commit** (update local migration reference)

```bash
# No local file to commit — migration applied via Supabase dashboard/MCP
```

---

### Task 9: Create rate limiting utility

**Files:**
- Create: `lib/rate-limit.ts`
- Test: `lib/__tests__/rate-limit.test.ts`

**Step 1: Write the failing test**

Create `lib/__tests__/rate-limit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk-test-key");
vi.stubEnv("SUPABASE_SECRET_KEY", "sk-test-key");

// Mock the server client
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockUpsert = vi.fn();

vi.mock("../supabase", () => ({
  createServerClient: () => ({
    from: mockFrom,
  }),
}));

describe("checkAnonymousRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: mockSelect,
      upsert: mockUpsert,
    });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it("allows first search from a new IP", async () => {
    // No existing record
    mockSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    mockUpsert.mockResolvedValue({ error: null });

    const { checkAnonymousRateLimit } = await import("../rate-limit");
    const result = await checkAnonymousRateLimit("1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("blocks when search_count >= 2", async () => {
    const recentWindowStart = new Date().toISOString();
    mockSingle.mockResolvedValue({
      data: { search_count: 2, window_start: recentWindowStart },
      error: null,
    });

    const { checkAnonymousRateLimit } = await import("../rate-limit");
    const result = await checkAnonymousRateLimit("1.2.3.4");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/rate-limit.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `lib/rate-limit.ts`:

```typescript
import { createServerClient } from "@/lib/supabase";

const ANONYMOUS_LIMIT = 2;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function checkAnonymousRateLimit(
  ip: string
): Promise<RateLimitResult> {
  const db = createServerClient();

  // Fetch existing rate limit record for this IP
  const { data, error } = await db
    .from("rate_limits")
    .select("search_count, window_start")
    .eq("ip_address", ip)
    .single();

  if (error || !data) {
    // No record — first search from this IP
    await db.from("rate_limits").upsert(
      {
        ip_address: ip,
        search_count: 1,
        window_start: new Date().toISOString(),
      },
      { onConflict: "ip_address" }
    );
    return { allowed: true, remaining: ANONYMOUS_LIMIT - 1 };
  }

  // Check if window has expired
  const windowStart = new Date(data.window_start).getTime();
  const now = Date.now();

  if (now - windowStart > WINDOW_MS) {
    // Window expired — reset
    await db.from("rate_limits").upsert(
      {
        ip_address: ip,
        search_count: 1,
        window_start: new Date().toISOString(),
      },
      { onConflict: "ip_address" }
    );
    return { allowed: true, remaining: ANONYMOUS_LIMIT - 1 };
  }

  // Within window — check count
  if (data.search_count >= ANONYMOUS_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  // Increment count
  await db.from("rate_limits").upsert(
    {
      ip_address: ip,
      search_count: data.search_count + 1,
      window_start: data.window_start,
    },
    { onConflict: "ip_address" }
  );

  return {
    allowed: true,
    remaining: ANONYMOUS_LIMIT - (data.search_count + 1),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/rate-limit.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/rate-limit.ts lib/__tests__/rate-limit.test.ts
git commit -m "feat(auth): add IP-based rate limiting for anonymous users"
```

---

### Task 10: Update `getSessionUserId` to support Supabase Auth

**Files:**
- Modify: `lib/supabase.ts`
- Modify: `lib/__tests__/supabase.test.ts`

This is the critical integration point. The existing `getSessionUserId()` reads a raw cookie. The new version checks Supabase Auth first, falls back to cookie.

**Step 1: Update the test**

In `lib/__tests__/supabase.test.ts`, add tests for the new auth-aware behavior. Keep the existing tests (they cover the anonymous fallback path).

Add these tests:

```typescript
describe("getSessionUserIdFromAuth", () => {
  it("returns auth user ID when Supabase session exists", async () => {
    const { getSessionUserIdFromAuth } = await import("../supabase");
    const mockAuthClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "auth-user-uuid-1234" } },
          error: null,
        }),
      },
    };
    const request = {
      cookies: { get: () => undefined },
    } as any;

    const userId = await getSessionUserIdFromAuth(request, mockAuthClient as any);
    expect(userId).toBe("auth-user-uuid-1234");
  });

  it("falls back to cookie when no auth session", async () => {
    const { getSessionUserIdFromAuth } = await import("../supabase");
    const mockAuthClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "not authenticated" },
        }),
      },
    };
    const request = {
      cookies: {
        get: (name: string) =>
          name === "github_scout_session"
            ? { value: "550e8400-e29b-41d4-a716-446655440000" }
            : undefined,
      },
    } as any;

    const userId = await getSessionUserIdFromAuth(request, mockAuthClient as any);
    expect(userId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/supabase.test.ts`
Expected: FAIL — `getSessionUserIdFromAuth` not found

**Step 3: Add the new function to `lib/supabase.ts`**

Add to `lib/supabase.ts` (keep all existing code):

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

// ...existing code stays...

/**
 * Get user ID with Supabase Auth priority, cookie fallback.
 * Use this in API routes that have access to the auth server client.
 */
export async function getSessionUserIdFromAuth(
  request: NextRequest,
  authClient: SupabaseClient
): Promise<string> {
  // Try Supabase Auth first
  try {
    const { data: { user }, error } = await authClient.auth.getUser();
    if (!error && user?.id) {
      return user.id;
    }
  } catch {
    // Auth check failed, fall through to cookie
  }

  // Fall back to anonymous cookie session
  return getSessionUserId(request);
}
```

**Step 4: Run tests**

Run: `npx vitest run lib/__tests__/supabase.test.ts`
Expected: PASS (both old and new tests)

**Step 5: Commit**

```bash
git add lib/supabase.ts lib/__tests__/supabase.test.ts
git commit -m "feat(auth): add getSessionUserIdFromAuth with Supabase Auth + cookie fallback"
```

---

### Task 11: Integrate rate limiting into POST /api/scout

**Files:**
- Modify: `app/api/scout/route.ts`

**Step 1: Add rate limit check at the top of the POST handler**

In `app/api/scout/route.ts`, after validating the query and before checking cache, add:

```typescript
import { createAuthServerClient } from "@/lib/supabase/server";
import { getSessionUserIdFromAuth } from "@/lib/supabase";
import { checkAnonymousRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/auth";
```

Then inside the `POST` function, after query validation and before cache check:

```typescript
    // Determine if user is authenticated
    const authClient = await createAuthServerClient();
    const userId = await getSessionUserIdFromAuth(request, authClient);
    const isAuthenticated = userId !== "anonymous" && userId !== getSessionUserId(request);

    // Rate limit anonymous users
    if (!isAuthenticated) {
      const ip = getClientIp(request.headers);
      const rateLimit = await checkAnonymousRateLimit(ip);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: "rate_limited",
            message: "You've used your 2 free searches. Sign in with Google to unlock unlimited searches.",
            remaining: 0,
          },
          { status: 429 }
        );
      }
    }
```

Also update the two places that call `getSessionUserId(request)` to use `userId` instead (the cache check and the insert).

**Step 2: Test locally**

Run: `npm run dev -- -p 3333`
1. Open browser (not logged in), search twice — should work
2. Search a third time — should get 429 error
Expected: Rate limiting works for anonymous users

**Step 3: Commit**

```bash
git add app/api/scout/route.ts
git commit -m "feat(auth): integrate rate limiting and auth-aware user ID in scout POST"
```

---

### Task 12: Update remaining API routes to use auth-aware user ID

**Files:**
- Modify: `app/api/history/route.ts`
- Modify: `app/api/scout/[id]/results/route.ts`
- Modify: `app/api/scout/[id]/deep-dive-v2/route.ts`

**Step 1: Update history route**

In `app/api/history/route.ts`, replace:
```typescript
import { createServerClient, getSessionUserId } from "@/lib/supabase";
```
with:
```typescript
import { createServerClient, getSessionUserIdFromAuth } from "@/lib/supabase";
import { createAuthServerClient } from "@/lib/supabase/server";
```

And update the handler:
```typescript
export async function GET(request: NextRequest) {
  const authClient = await createAuthServerClient();
  const userId = await getSessionUserIdFromAuth(request, authClient);
  // ...rest stays the same
```

**Step 2: Update results route**

In `app/api/scout/[id]/results/route.ts`, same pattern — use `getSessionUserIdFromAuth` + `createAuthServerClient`. Replace the synchronous `getSessionUserId(request)` call with the async version.

**Step 3: Update deep-dive-v2 route**

In `app/api/scout/[id]/deep-dive-v2/route.ts`, same pattern.

**Step 4: Run all existing tests**

Run: `npx vitest run`
Expected: All 84+ tests pass (no regressions)

**Step 5: Commit**

```bash
git add app/api/history/route.ts app/api/scout/[id]/results/route.ts app/api/scout/[id]/deep-dive-v2/route.ts
git commit -m "feat(auth): update all API routes to use auth-aware user identification"
```

---

### Task 13: Add anonymous history merge on first login

**Files:**
- Modify: `app/auth/callback/route.ts`

**Step 1: Add history merge logic to the callback**

Update `app/auth/callback/route.ts`. After `exchangeCodeForSession` succeeds and before the redirect:

```typescript
import { createServerClient as createServiceClient } from "@/lib/supabase";
import { isValidSessionId } from "@/lib/session";

// ... inside the if (!error) block, after exchangeCodeForSession:

// Merge anonymous history on first login
try {
  const cookieHeader = request.headers.get("cookie") || "";
  const sessionMatch = cookieHeader.match(/github_scout_session=([^;]+)/);
  const oldSessionId = sessionMatch?.[1];

  if (oldSessionId && isValidSessionId(oldSessionId)) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const db = createServiceClient();

      // Check if this user already has searches (not first login)
      const { data: existing } = await db
        .from("searches")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (!existing || existing.length === 0) {
        // First login — migrate anonymous searches to this user
        await db
          .from("searches")
          .update({ user_id: user.id })
          .eq("user_id", oldSessionId);
      }
    }
  }
} catch (mergeError) {
  // Non-fatal — don't block the login flow
  console.error("[auth/callback] History merge error:", mergeError);
}
```

**Step 2: Test locally**

1. Search as anonymous (creates searches with cookie UUID)
2. Sign in with Google
3. Check history — should show the anonymous searches

**Step 3: Commit**

```bash
git add app/auth/callback/route.ts
git commit -m "feat(auth): merge anonymous search history on first Google login"
```

---

### Task 14: Update Header with sign-in button and user dropdown

**Files:**
- Modify: `components/shared/Header.tsx`

**Step 1: Add auth UI to the header**

Replace the entire `Header` component in `components/shared/Header.tsx`:

```typescript
"use client";

import Link from "next/link";
import { GlobalSearchStatus } from "./GlobalSearchStatus";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/hooks/useAuth";

export function Header() {
  const { user, loading, signIn, signOut } = useAuth();

  return (
    <>
      {/* Skip to main content — visible only on keyboard focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-teal focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-teal-foreground focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-1.5 group" aria-label="Git Scout — Home">
            <span className="inline-block h-3 w-3 rounded-sm bg-teal transition-transform group-hover:scale-110 group-hover:rotate-12" aria-hidden="true" />
            <span className="font-serif font-bold text-2xl tracking-tight text-foreground">
              Git Scout
            </span>
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="/history"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              History
            </Link>
            <GlobalSearchStatus />
            <ThemeToggle />

            {/* Auth section */}
            {!loading && (
              user ? (
                <div className="relative group">
                  <button
                    className="flex items-center gap-2 rounded-full border border-border/60 px-2 py-1 text-sm transition-colors hover:bg-muted"
                    aria-label="Account menu"
                  >
                    {user.user_metadata?.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt=""
                        className="h-6 w-6 rounded-full"
                      />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal text-xs font-medium text-white">
                        {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
                      </span>
                    )}
                    <span className="hidden sm:inline text-xs text-muted-foreground max-w-[120px] truncate">
                      {user.user_metadata?.full_name || user.email}
                    </span>
                  </button>
                  {/* Dropdown */}
                  <div className="absolute right-0 top-full mt-1 hidden w-48 rounded-md border border-border bg-background p-1 shadow-lg group-focus-within:block group-hover:block">
                    <div className="px-3 py-2 text-xs text-muted-foreground truncate">
                      {user.email}
                    </div>
                    <hr className="my-1 border-border" />
                    <button
                      onClick={() => signOut()}
                      className="w-full rounded-sm px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => signIn("google")}
                  className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Sign in
                </button>
              )
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
```

**Step 2: Test locally**

Run: `npm run dev -- -p 3333`
- Verify "Sign in" button appears in header
- Verify clicking it redirects to Google (requires Supabase Google provider to be configured)
- Verify logged-in state shows avatar + dropdown

**Step 3: Commit**

```bash
git add components/shared/Header.tsx
git commit -m "feat(auth): add Google sign-in button and user dropdown to header"
```

---

### Task 15: Add rate limit prompt on home page

**Files:**
- Modify: `app/page.tsx`

**Step 1: Handle 429 response in handleSubmit**

In `app/page.tsx`, update the `handleSubmit` callback to detect the 429 response:

```typescript
// Add state for rate limit
const [rateLimited, setRateLimited] = useState(false);
```

In the `handleSubmit` function, after `const res = await fetch(...)`:

```typescript
if (res.status === 429) {
  setRateLimited(true);
  return;
}
```

**Step 2: Add the rate limit prompt in the JSX**

Below the `<SearchInput />` and `<ModeIndicator />`, add:

```tsx
{rateLimited && (
  <div className="w-full rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
    <p className="text-sm text-amber-800">
      You&rsquo;ve used your 2 free searches. Sign in with Google to unlock unlimited searches and track your history.
    </p>
    <button
      onClick={() => {
        const { signIn } = require("@/lib/supabase/client");
        // Use direct import to avoid hook outside component rules
        import("@/lib/supabase/client").then(({ createBrowserClient }) => {
          const supabase = createBrowserClient();
          supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}/auth/callback` },
          });
        });
      }}
      className="mt-3 inline-flex items-center gap-2 rounded-md bg-teal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal/90"
    >
      Sign in with Google
    </button>
  </div>
)}
```

**Step 3: Test locally**

1. Clear cookies, search twice
2. Third search should show the rate limit prompt
3. Clicking "Sign in with Google" should redirect to Google

**Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(auth): show sign-in prompt when anonymous rate limit is hit"
```

---

### Task 16: Remove old session cookie after auth migration

**Files:**
- Modify: `app/page.tsx`

**Step 1: Stop calling getOrCreateSessionId for authenticated users**

In `app/page.tsx`, update the `handleSubmit` to conditionally create the cookie:

```typescript
import { useAuth } from "@/hooks/useAuth";

// Inside HomePage component:
const { user } = useAuth();

// In handleSubmit, replace:
//   getOrCreateSessionId();
// with:
if (!user) {
  getOrCreateSessionId();
}
```

This ensures authenticated users don't get a redundant anonymous cookie.

**Step 2: Test locally**

1. Sign in with Google
2. Search — should not create a `github_scout_session` cookie
3. Sign out — search should create the cookie again

**Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(auth): skip anonymous session cookie for authenticated users"
```

---

### Task 17: Run full test suite and verify

**Files:** None (verification only)

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (84+ existing + new auth/rate-limit tests)

**Step 2: Run the build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Manual smoke test**

Run: `npm run dev -- -p 3333`

Test these flows:
1. **Anonymous search**: Search works (up to 2 times)
2. **Rate limit**: Third anonymous search shows 429 + sign-in prompt
3. **Sign in**: Click "Sign in with Google" → Google consent → redirects back, user avatar shows in header
4. **Authenticated search**: Search works without limit
5. **History**: Previous anonymous searches appear in history (merged)
6. **Sign out**: Click avatar → "Sign out" → returns to anonymous state

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```

---

### Task 18: Configure Google OAuth in Supabase (external setup)

This task is manual configuration, not code.

**Step 1: Google Cloud Console**

1. Go to https://console.cloud.google.com/apis/credentials
2. Create a new OAuth 2.0 Client ID (Web application type)
3. **Authorized JavaScript origins**:
   - `http://localhost:3333`
   - Your production URL (if deployed)
4. **Authorized redirect URIs**:
   - `https://fnylozxqgmnzvdbshzvn.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client Secret**

**Step 2: Supabase Dashboard**

1. Go to Supabase Dashboard → Authentication → Providers → Google
2. Enable Google provider
3. Paste Client ID and Client Secret
4. Go to URL Configuration → Redirect URLs
5. Add: `http://localhost:3333/auth/callback`
6. Add: Your production URL + `/auth/callback` (if deployed)

**Step 3: Verify**

Run the app and click "Sign in with Google" — should redirect to Google consent screen and back.

---

## Summary

| Task | Description | Files | Estimated Steps |
|------|-------------|-------|-----------------|
| 1 | Install @supabase/ssr | package.json | 3 |
| 2 | Browser client | lib/supabase/client.ts | 5 |
| 3 | Server client | lib/supabase/server.ts | 3 |
| 4 | Auth middleware | middleware.ts + helper | 4 |
| 5 | Callback route | app/auth/callback/route.ts | 2 |
| 6 | Auth utilities | lib/auth.ts | 5 |
| 7 | useAuth hook | hooks/useAuth.ts | 3 |
| 8 | rate_limits table | Supabase migration | 2 |
| 9 | Rate limit utility | lib/rate-limit.ts | 5 |
| 10 | Auth-aware getSessionUserId | lib/supabase.ts | 5 |
| 11 | Rate limit in scout POST | app/api/scout/route.ts | 3 |
| 12 | Update all API routes | 3 route files | 5 |
| 13 | History merge | app/auth/callback/route.ts | 3 |
| 14 | Header UI | Header.tsx | 3 |
| 15 | Rate limit prompt | app/page.tsx | 4 |
| 16 | Skip cookie for auth users | app/page.tsx | 3 |
| 17 | Full verification | - | 4 |
| 18 | Google Cloud + Supabase config | External | 3 |

**Total: 18 tasks, ~65 steps, ~15 commits**
