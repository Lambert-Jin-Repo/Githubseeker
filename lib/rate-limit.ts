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

  const windowStart = new Date(data.window_start).getTime();
  const now = Date.now();

  if (now - windowStart > WINDOW_MS) {
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

  if (data.search_count >= ANONYMOUS_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

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
