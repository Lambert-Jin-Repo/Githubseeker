# Google OAuth & Rate Limiting — Design Document

**Date:** 2026-02-26
**Status:** Approved
**Approach:** Supabase Auth (native Google OAuth with PKCE)

## Goals

1. Add Google login so authenticated users can track search history across devices
2. Demonstrate OAuth knowledge for portfolio (PKCE flow, provider config, session management)
3. Rate-limit anonymous users to 2 searches (cookie + IP-based enforcement)
4. Structure auth code to be provider-agnostic (GitHub, Microsoft ready with no code changes)

## Architecture

### Auth Flow (PKCE)

```
User clicks "Sign in with Google" (header)
→ supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: '/auth/callback' })
→ Supabase generates PKCE code verifier + challenge
→ Google consent screen
→ Google redirects to Supabase: https://<project>.supabase.co/auth/v1/callback
→ Supabase redirects to app: /auth/callback?code=<code>
→ exchangeCodeForSession(code) completes PKCE, writes session cookie
→ Redirect to home page (logged in)
```

### File Structure

```
lib/supabase/client.ts       — createBrowserClient (singleton, provider-agnostic)
lib/supabase/server.ts        — createServerClient (per-request, uses cookies())
lib/supabase/middleware.ts     — updateSession helper for token refresh
lib/auth.ts                    — signIn(provider), signOut(), useAuth() hook
lib/rate-limit.ts              — checkRateLimit(request) for anonymous users
middleware.ts                  — Next.js middleware entry (calls updateSession)
app/auth/callback/route.ts     — PKCE code exchange handler
```

### Provider-Agnostic Design

The `signIn` function takes a provider parameter:

```typescript
export async function signIn(provider: 'google' | 'github' | 'azure') {
  const supabase = createClient()
  await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
}
```

Adding a new provider = enable in Supabase dashboard + add button in header. No code changes to callback, middleware, RLS, rate limiting, or database schema.

## Database Changes

### No schema migration for existing tables

`user_id` in `searches` stays as `text`. It stores:
- Supabase `auth.uid()` (UUID) for logged-in users
- Cookie session UUID for anonymous users
- `"anonymous"` as fallback

### New table: `rate_limits`

```sql
CREATE TABLE rate_limits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address text NOT NULL,
  search_count integer DEFAULT 0,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_rate_limits_ip ON rate_limits (ip_address);
```

- 24h rolling window per IP
- When `window_start` > 24h old, reset `search_count` to 0
- Only checked for anonymous users

### History merge on first login

When a user completes their first Google login:
1. Read the `github_scout_session` cookie (old anonymous UUID)
2. `UPDATE searches SET user_id = <auth_user_id> WHERE user_id = <old_cookie_uuid>`
3. `UPDATE feedback SET ... WHERE search_id IN (migrated searches)`
4. Delete the old cookie

Only runs once — during the same request that completes first-ever OAuth login.

## Security

### Strengths
- **PKCE flow** — prevents authorization code interception (OAuth 2.0 best practice)
- **`getClaims()` on server** — validates JWT signature, never trusts raw cookies
- **RLS with `auth.uid()`** — authenticated routes use SSR client, not service role
- **Open redirect guard** — callback route validates `next` param starts with `/`
- **CSRF** — inherently handled by PKCE code verifier
- **IP rate limiting** — hard limit prevents cookie-clearing bypass

### Service role client usage
Reserved for background/system operations only:
- Deep dive precompute (no user session available)
- History merge (one-time migration)
- Rate limit table writes (system-level, not user-scoped)

### Rate Limiting

| User type | Limit | Enforcement |
|-----------|-------|-------------|
| Anonymous | 2 searches / 24h | Cookie count + IP-based hard limit |
| Logged in | Unlimited | No limit |

## UI Changes

### Header (`components/shared/Header.tsx`)
- **Logged out:** "Sign in with Google" button (Google icon, teal accent)
- **Logged in:** User avatar (Google profile photo) + dropdown (name, email, "Sign out")

### Search limit prompt
When anonymous user hits limit, inline message below search bar:
> "You've used your 2 free searches. Sign in with Google to unlock unlimited searches and track your history."

With a "Sign in with Google" button.

### History list
No visual changes. Works better now because `user_id` is stable across devices.

## Dependencies

```
@supabase/ssr    — SSR client with cookie handling for Next.js App Router
```

Already have `@supabase/supabase-js`. The `@supabase/ssr` package is the only new dependency.

## External Setup Required

1. **Google Cloud Console:** Create OAuth 2.0 client ID (Web application type)
   - Authorized JavaScript origins: `http://localhost:3333`, production URL
   - Authorized redirect URIs: `https://<project>.supabase.co/auth/v1/callback`
2. **Supabase Dashboard:** Enable Google provider, paste Client ID + Secret
   - Add `http://localhost:3333/auth/callback` and production URL to Redirect Allow List
