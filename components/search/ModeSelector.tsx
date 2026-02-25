"use client";

import type { ScoutMode } from "@/lib/types";
import { BookOpen, Hammer, Compass } from "lucide-react";

const MODES: { value: ScoutMode; label: string; icon: typeof BookOpen }[] = [
  { value: "LEARN", label: "Learn", icon: BookOpen },
  { value: "BUILD", label: "Build", icon: Hammer },
  { value: "SCOUT", label: "Scout", icon: Compass },
];

interface ModeSelectorProps {
  value: ScoutMode | null;
  onChange: (mode: ScoutMode) => void;
}

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <div className="flex gap-2">
      {MODES.map(({ value: mode, label, icon: Icon }) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all duration-200 ${
            value === mode
              ? "border-teal bg-teal/5 text-teal shadow-sm"
              : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
