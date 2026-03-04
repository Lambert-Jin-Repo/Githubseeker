"use client";

import { useState, useEffect } from "react";
import { Keyboard } from "lucide-react";

const STORAGE_KEY = "git-scout-shortcut-hint-dismissed";

/**
 * A small muted hint in the bottom-right corner that fades out after 5 seconds.
 * Only shown once (persisted via localStorage).
 */
export function KeyboardShortcutHint() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Only show if not previously dismissed
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // localStorage unavailable — don't show
      return;
    }

    setVisible(true);

    // Mark as dismissed immediately so it only shows once
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore
    }

    // Start fade-out after 4 seconds, then hide after transition (1s)
    const fadeTimer = setTimeout(() => setFading(true), 4000);
    const hideTimer = setTimeout(() => setVisible(false), 5000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-md border border-border/50 bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm transition-opacity duration-1000 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      aria-live="polite"
    >
      <Keyboard className="size-3" aria-hidden="true" />
      Press <kbd className="rounded border border-border bg-muted/60 px-1 font-mono text-[10px] font-medium">?</kbd> for shortcuts
    </div>
  );
}
