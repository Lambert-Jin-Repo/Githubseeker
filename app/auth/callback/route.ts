import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/server";
import { createServerClient as createServiceClient } from "@/lib/supabase";
import { isValidSessionId } from "@/lib/session";

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
      // Merge anonymous history on first login
      try {
        const cookieHeader = request.headers.get("cookie") || "";
        const sessionMatch = cookieHeader.match(/github_scout_session=([^;]+)/);
        const oldSessionId = sessionMatch?.[1];

        if (oldSessionId && isValidSessionId(oldSessionId)) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const db = createServiceClient();
            const { data: existing } = await db
              .from("searches")
              .select("id")
              .eq("user_id", user.id)
              .limit(1);

            if (!existing || existing.length === 0) {
              await db
                .from("searches")
                .update({ user_id: user.id })
                .eq("user_id", oldSessionId);
            }
          }
        }
      } catch (mergeError) {
        console.error("[auth/callback] History merge error:", mergeError);
      }

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

  return NextResponse.redirect(`${origin}/?auth_error=true`);
}
