"use client";

import { cn } from "@/lib/utils";

interface ConfidenceIndicatorProps {
  confidence: "high" | "medium" | "low";
  className?: string;
}

const confidenceConfig = {
  high: {
    label: "High confidence",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  medium: {
    label: "Medium",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  low: {
    label: "Low",
    className: "bg-gray-50 text-gray-500 border-gray-200",
  },
} as const;

export function ConfidenceIndicator({
  confidence,
  className,
}: ConfidenceIndicatorProps) {
  const config = confidenceConfig[confidence];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
