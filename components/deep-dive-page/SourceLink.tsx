import { ExternalLink } from "lucide-react";
import type { SourceLink as SourceLinkType } from "@/lib/types";

export function SourceLink({ label, url }: SourceLinkType) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded bg-teal/10 px-1.5 py-0.5 text-xs font-medium text-teal transition-colors hover:bg-teal/20"
    >
      {label}
      <ExternalLink className="size-3" aria-hidden="true" />
    </a>
  );
}
