"use client";

import { useState, useCallback } from "react";
import { useHotkeys } from "@/hooks/useHotkeys";
import { KeyboardShortcutsOverlay } from "./KeyboardShortcutsOverlay";
import { KeyboardShortcutHint } from "./KeyboardShortcutHint";

/**
 * Global keyboard shortcut provider.
 * Handles `/` (focus search), `?` (toggle overlay), `Escape` (close/blur).
 * Placed in the root layout so it's available on every page.
 */
export function KeyboardShortcutProvider() {
  const [overlayOpen, setOverlayOpen] = useState(false);

  const handleSlash = useCallback(
    (e: KeyboardEvent) => {
      // Don't interfere if overlay is open
      if (overlayOpen) return;

      e.preventDefault();

      // Try to find and focus a search input.  The home page SearchInput uses
      // a plain <input> inside a wrapper; we look for it by placeholder text
      // or fall back to any visible text input.
      const searchInput =
        document.querySelector<HTMLInputElement>(
          'input[placeholder*="discover"]'
        ) ??
        document.querySelector<HTMLInputElement>(
          'input[type="text"]:not([hidden])'
        );

      if (searchInput) {
        searchInput.focus();
        searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [overlayOpen]
  );

  const handleQuestion = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      setOverlayOpen((prev) => !prev);
    },
    []
  );

  const handleEscape = useCallback(() => {
    if (overlayOpen) {
      setOverlayOpen(false);
      return;
    }
    // Blur any focused input
    if (
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
    ) {
      (document.activeElement as HTMLElement).blur();
    }
  }, [overlayOpen]);

  useHotkeys(
    {
      "/": handleSlash,
      "?": handleQuestion,
      Escape: handleEscape,
    },
    [handleSlash, handleQuestion, handleEscape]
  );

  return (
    <>
      <KeyboardShortcutsOverlay
        open={overlayOpen}
        onOpenChange={setOverlayOpen}
      />
      <KeyboardShortcutHint />
    </>
  );
}
