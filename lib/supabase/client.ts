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
