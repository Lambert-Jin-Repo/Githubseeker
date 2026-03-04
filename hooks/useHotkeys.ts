import { useEffect } from "react";

/**
 * Lightweight keyboard shortcut hook.
 *
 * `keymap` maps descriptors like `"j"`, `"?"`, `"ctrl+k"`, `"Escape"` to
 * handler functions.  Events that originate inside `<input>`, `<textarea>`,
 * or `[contenteditable]` elements are silently ignored so shortcuts never
 * interfere with text editing.
 *
 * Cleanup happens automatically on unmount or when `deps` change.
 */
export function useHotkeys(
  keymap: Record<string, (e: KeyboardEvent) => void>,
  deps: unknown[] = []
): void {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Never intercept when the user is typing in an editable element
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable ||
        target?.contentEditable === "true"
      ) {
        return;
      }

      // Build the descriptor for this event, e.g. "ctrl+k" or "?"
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("ctrl");
      if (e.metaKey) parts.push("meta");
      if (e.altKey) parts.push("alt");
      if (e.shiftKey && e.key.length > 1) parts.push("shift"); // only for non-printable keys

      // Normalise key
      const key = e.key.length === 1 ? e.key : e.key;
      parts.push(key.toLowerCase());

      const descriptor = parts.join("+");

      // Also try without modifiers for single printable characters like "?" or "/"
      const simpleKey = e.key;

      const cb = keymap[descriptor] ?? keymap[simpleKey];
      if (cb) {
        cb(e);
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
