"use client";

import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { RepoVerification } from "@/lib/types";
import {
  getOverallVerificationStatus,
  type OverallStatus,
} from "@/lib/verification";
import { cn } from "@/lib/utils";

interface VerificationBadgeProps {
  verification: RepoVerification;
  className?: string;
}

const statusConfig: Record<
  OverallStatus,
  {
    label: string;
    icon: typeof ShieldCheck;
    className: string;
  }
> = {
  fully_verified: {
    label: "Verified",
    icon: ShieldCheck,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  partially_verified: {
    label: "Partial",
    icon: ShieldAlert,
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  unverified: {
    label: "Unverified",
    icon: ShieldQuestion,
    className: "bg-gray-50 text-gray-500 border-gray-200",
  },
};

function levelToLabel(level: string): string {
  switch (level) {
    case "verified":
      return "Verified";
    case "inferred":
      return "Inferred";
    case "unverified":
      return "Unverified";
    case "stale":
      return "Stale";
    case "conflicting":
      return "Conflicting";
    default:
      return level;
  }
}

function levelToColor(level: string): string {
  switch (level) {
    case "verified":
      return "text-emerald-600";
    case "inferred":
      return "text-blue-500";
    case "unverified":
      return "text-gray-400";
    case "stale":
      return "text-amber-500";
    case "conflicting":
      return "text-red-500";
    default:
      return "text-gray-400";
  }
}

export function VerificationBadge({
  verification,
  className,
}: VerificationBadgeProps) {
  const status = getOverallVerificationStatus(verification);
  const config = statusConfig[status];
  const Icon = config.icon;

  const layers = [
    { label: "Existence", value: verification.existence.status },
    { label: "Stars", value: verification.stars.level },
    { label: "Last Commit", value: verification.last_commit.level },
    { label: "Language", value: verification.language.level },
    { label: "License", value: verification.license.level },
    { label: "Freshness", value: verification.freshness.level },
    { label: "Community", value: verification.community.level },
  ];

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
            <Icon className="size-3" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 py-1">
            <p className="text-xs font-semibold">Verification Breakdown</p>
            {layers.map((layer) => (
              <div
                key={layer.label}
                className="flex items-center justify-between gap-4 text-xs"
              >
                <span className="text-gray-300">{layer.label}</span>
                <span className={cn("font-medium", levelToColor(layer.value))}>
                  {levelToLabel(layer.value)}
                </span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
