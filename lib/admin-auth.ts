import { createAuthServerClient } from "@/lib/supabase/server";
import { createServerClient } from "@/lib/supabase";

interface AdminCheckResult {
  authorized: boolean;
  userId?: string;
  status?: number;
  error?: string;
}

export async function verifyAdmin(): Promise<AdminCheckResult> {
  const authClient = await createAuthServerClient();
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return { authorized: false, status: 401, error: "Unauthorized" };
  }

  const admin = createServerClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return {
      authorized: false,
      status: 403,
      error: "Forbidden — admin access required",
    };
  }

  return { authorized: true, userId: user.id };
}
