"use client";

import Link from "next/link";
import { GlobalSearchStatus } from "./GlobalSearchStatus";

export function Header() {
  return (
    <>
      {/* Skip to main content — visible only on keyboard focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-teal focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-teal-foreground focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-50 border-b border-border/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-1.5 group" aria-label="Git Scout — Home">
            <span className="inline-block h-3 w-3 rounded-sm bg-teal transition-transform group-hover:scale-110 group-hover:rotate-12" aria-hidden="true" />
            <span className="font-serif font-bold text-2xl tracking-tight text-foreground">
              Git Scout
            </span>
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-4">
            <Link
              href="/history"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              History
            </Link>
            <GlobalSearchStatus />
          </nav>
        </div>
      </header>
    </>
  );
}
