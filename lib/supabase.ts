import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { isValidSessionId } from "./session";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Client-side Supabase client (uses publishable key)
export const supabase = createClient(supabaseUrl, supabasePublishableKey);

// Singleton server-side client (service role is stateless, safe to reuse)
let _serverClient: SupabaseClient | null = null;

// Server-side Supabase client (uses service role key, bypasses RLS)
export function createServerClient() {
  if (_serverClient) return _serverClient;
  const secretKey = process.env.SUPABASE_SECRET_KEY!;
  _serverClient = createClient(supabaseUrl, secretKey);
  return _serverClient;
}

const SESSION_COOKIE_NAME = "github_scout_session";

// Extract user ID from session cookie on a server request
export function getSessionUserId(request: NextRequest): string {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME);
  const value = cookie?.value;
  if (value && isValidSessionId(value)) {
    return value;
  }
  return "anonymous";
}

/**
 * Get user ID with Supabase Auth priority, cookie fallback.
 */
export async function getSessionUserIdFromAuth(
  request: NextRequest,
  authClient: SupabaseClient
): Promise<string> {
  try {
    const { data: { user }, error } = await authClient.auth.getUser();
    if (!error && user?.id) {
      return user.id;
    }
  } catch {
    // Auth check failed, fall through to cookie
  }
  return getSessionUserId(request);
}
