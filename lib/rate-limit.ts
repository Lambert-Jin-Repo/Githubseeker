import { createServerClient } from "@/lib/supabase";

const ANONYMOUS_LIMIT = 2;
const WINDOW_HOURS = 24;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function checkAnonymousRateLimit(
  ip: string
): Promise<RateLimitResult> {
  const db = createServerClient();

  const { data, error } = await db.rpc("check_and_increment_rate_limit", {
    p_ip: ip,
    p_limit: ANONYMOUS_LIMIT,
    p_window_hours: WINDOW_HOURS,
  });

  if (error || !data || data.length === 0) {
    // On RPC failure, allow the request (fail-open) but log
    console.error("[rate-limit] RPC error:", error?.message);
    return { allowed: true, remaining: 0 };
  }

  const row = data[0] as { allowed: boolean; remaining: number };
  return { allowed: row.allowed, remaining: row.remaining };
}
