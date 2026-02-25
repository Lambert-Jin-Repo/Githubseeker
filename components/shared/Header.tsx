"use client";

import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-1.5 group">
          <span className="inline-block h-2 w-2 rounded-full bg-teal transition-transform group-hover:scale-125" />
          <span className="font-serif text-2xl italic text-foreground tracking-tight">
            Scout
          </span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/history"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            History
          </Link>
        </nav>
      </div>
    </header>
  );
}
