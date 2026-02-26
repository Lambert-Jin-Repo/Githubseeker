"use client";

import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfidenceIndicator } from "@/components/deep-dive/ConfidenceIndicator";
import { SourcesRow } from "../SourcesRow";
import type { SecurityPosture } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SecuritySectionProps {
  security: SecurityPosture;
}

function BoolItem({ value, label }: { value: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      {value ? (
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-label="Yes" />
      ) : (
        <XCircle className="size-4 shrink-0 text-muted-foreground/40" aria-label="No" />
      )}
      <span
        className={cn(
          "text-sm",
          value ? "text-foreground" : "text-muted-foreground/60"
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function SecuritySection({ security }: SecuritySectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h4 className="font-serif text-lg text-foreground">Security</h4>
        <ConfidenceIndicator confidence={security.confidence} />
      </div>

      <div className="space-y-4">
        {/* Boolean indicators */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <BoolItem value={security.has_security_policy} label="Security Policy" />
          <BoolItem value={security.has_env_example} label=".env.example" />
          <BoolItem value={security.env_vars_documented} label="Env Vars Documented" />
          <BoolItem
            value={!security.known_vulnerabilities_mentioned}
            label="No Known Vulnerabilities"
          />
        </div>

        {/* License */}
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">License:</span>
          <span className="text-sm font-medium text-foreground">
            {security.license_type}
          </span>
          {security.license_commercial_friendly && (
            <Badge
              variant="outline"
              className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200"
            >
              Commercial Friendly
            </Badge>
          )}
        </div>

        {/* Auth patterns */}
        {security.auth_patterns.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Auth Patterns
            </span>
            <div className="flex flex-wrap gap-1.5">
              {security.auth_patterns.map((pattern) => (
                <Badge
                  key={pattern}
                  variant="outline"
                  className="text-xs font-normal border-border bg-muted/50 text-muted-foreground"
                >
                  {pattern}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <SourcesRow sources={security.sources} />
    </div>
  );
}
