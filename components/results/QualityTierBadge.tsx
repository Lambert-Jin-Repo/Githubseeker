"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { QualityTier } from "@/lib/types";
import { cn } from "@/lib/utils";

interface QualityTierBadgeProps {
  tier: QualityTier;
  className?: string;
}

const tierConfig: Record<
  QualityTier,
  { stars: string; label: string; className: string; tooltip: string }
> = {
  1: {
    stars: "\u2605\u2605\u2605",
    label: "Tier 1",
    className: "bg-teal/10 text-teal border-teal/20",
    tooltip: "Top quality: high stars, active maintenance, strong community",
  },
  2: {
    stars: "\u2605\u2605",
    label: "Tier 2",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    tooltip: "Good quality: solid project with moderate activity",
  },
  3: {
    stars: "\u2605",
    label: "Tier 3",
    className: "bg-gray-50 text-gray-500 border-gray-200",
    tooltip: "Emerging: newer or less established project",
  },
};

export function QualityTierBadge({ tier, className }: QualityTierBadgeProps) {
  const config = tierConfig[tier];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "animate-badge-pop cursor-default border px-2 py-0.5 text-xs font-medium tracking-wide",
              config.className,
              className
            )}
          >
            {config.stars}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">
            <span className="font-semibold">{config.label}</span>
            {" \u2014 "}
            {config.tooltip}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
