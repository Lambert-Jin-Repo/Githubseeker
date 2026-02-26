"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { OAuthProvider } from "@/lib/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();

    supabase.auth.getUser().then((response: { data: { user: User | null } }) => {
      setUser(response.data.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
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
