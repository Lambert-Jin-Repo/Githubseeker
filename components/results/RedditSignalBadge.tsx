"use client";

import { MessageCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { RedditSignal } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RedditSignalBadgeProps {
  signal: RedditSignal;
  details?: string;
  className?: string;
}

const signalConfig: Record<
  RedditSignal,
  { label: string; className: string; tooltip: string }
> = {
  validated: {
    label: "Reddit +",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    tooltip: "Positively discussed on Reddit",
  },
  mixed: {
    label: "Reddit ~",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    tooltip: "Mixed sentiment on Reddit",
  },
  no_data: {
    label: "No signal",
    className: "bg-gray-50 text-gray-400 border-gray-200",
    tooltip: "No Reddit discussion found",
  },
};

export function RedditSignalBadge({
  signal,
  details,
  className,
}: RedditSignalBadgeProps) {
  const config = signalConfig[signal];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "animate-badge-pop cursor-default gap-1 border px-2 py-0.5 text-xs font-medium",
              config.className,
              className
            )}
          >
            <MessageCircle className="size-3" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{details || config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
