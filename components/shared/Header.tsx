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

            {/* Auth UI */}
            {!loading && !user && (
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
            )}

            {!loading && user && (
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
            )}
          </nav>
        </div>
      </header>
    </>
  );
}

