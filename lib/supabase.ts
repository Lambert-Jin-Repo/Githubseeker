import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Client-side Supabase client (uses publishable key)
export const supabase = createClient(supabaseUrl, supabasePublishableKey);

// Server-side Supabase client (uses secret key)
export function createServerClient(userId: string) {
  const secretKey = process.env.SUPABASE_SECRET_KEY!;
  return createClient(supabaseUrl, secretKey);
}
