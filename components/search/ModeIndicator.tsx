"use client";

import type { ScoutMode } from "@/lib/types";
import { BookOpen, Hammer, Compass } from "lucide-react";

const MODE_CONFIG: Record<ScoutMode, { icon: typeof BookOpen; label: string; description: string; color: string }> = {
  LEARN: {
    icon: BookOpen,
    label: "Learn",
    description: "Finding tutorials, learning resources, and beginner-friendly projects",
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  BUILD: {
    icon: Hammer,
    label: "Build",
    description: "Finding production templates, architectures, and starter kits",
    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  SCOUT: {
    icon: Compass,
    label: "Scout",
    description: "Mapping the landscape of tools, alternatives, and opportunities",
    color: "text-amber-700 bg-amber-50 border-amber-200",
  },
};

interface ModeIndicatorProps {
  mode: ScoutMode | null;
  onOverride: (mode: ScoutMode) => void;
}

export function ModeIndicator({ mode, onOverride }: ModeIndicatorProps) {
  if (!mode) return null;

  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  return (
    <div className="animate-slide-up flex items-center gap-3">
      <div className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium ${config.color}`}>
        <Icon className="h-3.5 w-3.5" />
        {config.label}
      </div>
      <span className="text-sm text-muted-foreground">{config.description}</span>
      <button
        onClick={() => {
          const modes: ScoutMode[] = ["LEARN", "BUILD", "SCOUT"];
          const next = modes[(modes.indexOf(mode) + 1) % 3];
          onOverride(next);
        }}
        className="text-xs font-medium text-teal hover:text-teal/80 transition-colors underline underline-offset-2 decoration-teal/30"
      >
        Change
      </button>
    </div>
  );
}
