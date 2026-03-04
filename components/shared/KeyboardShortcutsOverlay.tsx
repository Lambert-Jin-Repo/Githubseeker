"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutEntry {
  keys: string[];
  action: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutEntry[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Global",
    shortcuts: [
      { keys: ["/"], action: "Focus search input" },
      { keys: ["?"], action: "Show keyboard shortcuts" },
      { keys: ["Esc"], action: "Close overlay / blur input" },
    ],
  },
  {
    title: "Results Page",
    shortcuts: [
      { keys: ["j"], action: "Select next repo in table" },
      { keys: ["k"], action: "Select previous repo in table" },
      { keys: ["Enter"], action: "Open deep dive for selected repo" },
      { keys: ["e"], action: "Export results" },
    ],
  },
  {
    title: "Deep Dive Page",
    shortcuts: [
      { keys: ["j"], action: "Next repo in sidebar" },
      { keys: ["k"], action: "Previous repo in sidebar" },
      { keys: ["["], action: "Previous section" },
      { keys: ["]"], action: "Next section" },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-muted/60 px-1.5 font-mono text-[11px] font-medium text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsOverlay({
  open,
  onOpenChange,
}: KeyboardShortcutsOverlayProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <Keyboard className="size-5 text-teal" aria-hidden="true" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Navigate Git Scout faster with keyboard shortcuts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-teal">
                {group.title}
              </h3>
              <ul className="space-y-1.5" role="list">
                {group.shortcuts.map((shortcut) => (
                  <li
                    key={shortcut.action}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="text-muted-foreground">
                      {shortcut.action}
                    </span>
                    <span className="flex items-center gap-1">
                      {shortcut.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
