"use client";

import { ExternalLink, FileCode2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfidenceIndicator } from "./ConfidenceIndicator";
import type { AgentEcosystemDiscovery } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AgentEcosystemSectionProps {
  ecosystem: AgentEcosystemDiscovery;
}

const fileTypeLabels: Record<string, string> = {
  cursorrules: "Cursor Rules",
  mcp_config: "MCP Config",
  claude_skills: "Claude Skills",
  agents_config: "Agent Config",
  other: "Config File",
};

const platformBadges = [
  { key: "cursor" as const, label: "Cursor", check: (e: AgentEcosystemDiscovery) => e.ecosystem_mapping.cursor.has_config },
  { key: "claude" as const, label: "Claude", check: (e: AgentEcosystemDiscovery) => e.ecosystem_mapping.claude.has_skills || e.ecosystem_mapping.claude.has_mcp },
  { key: "mcp" as const, label: "MCP", check: (e: AgentEcosystemDiscovery) => e.ecosystem_mapping.claude.has_mcp },
];

export function AgentEcosystemSection({ ecosystem }: AgentEcosystemSectionProps) {
  const hasContent =
    ecosystem.discovered_files.length > 0 ||
    ecosystem.trending_tools.length > 0 ||
    ecosystem.ecosystem_mapping.other_agents.length > 0;

  if (!hasContent) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h4 className="flex items-center gap-2 font-serif text-lg text-foreground">
          <Search className="size-4 text-teal" />
          Agent Ecosystem Discovery
        </h4>
        <ConfidenceIndicator confidence={ecosystem.confidence} />
      </div>

      <div className="rounded-lg border border-teal/20 bg-teal/[0.03] p-4 space-y-5">
        {/* Discovered Files */}
        {ecosystem.discovered_files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <FileCode2 className="size-3.5" />
              Discovered Files
            </div>
            <div className="space-y-2">
              {ecosystem.discovered_files.map((file) => (
                <div
                  key={file.url}
                  className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-background/80 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-teal">{file.path}</code>
                      <Badge variant="outline" className="text-[10px] border-border bg-muted/50 text-muted-foreground">
                        {fileTypeLabels[file.type] || file.type}
                      </Badge>
                    </div>
                    {file.summary && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{file.summary}</p>
                    )}
                  </div>
                  {file.url && (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground/50 hover:text-teal transition-colors"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Platform Support */}
        {(ecosystem.ecosystem_mapping.cursor.has_config ||
          ecosystem.ecosystem_mapping.claude.has_skills ||
          ecosystem.ecosystem_mapping.claude.has_mcp ||
          ecosystem.ecosystem_mapping.other_agents.length > 0) && (
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Platform Support
            </div>
            <div className="flex flex-wrap gap-1.5">
              {platformBadges.map(({ key, label, check }) => {
                const active = check(ecosystem);
                return (
                  <Badge
                    key={key}
                    variant="outline"
                    className={cn(
                      "text-xs font-medium",
                      active
                        ? "border-teal/30 bg-teal/10 text-teal"
                        : "border-border bg-muted/50 text-muted-foreground/50"
                    )}
                  >
                    {label} {active ? "\u2713" : "\u2717"}
                  </Badge>
                );
              })}
              {ecosystem.ecosystem_mapping.other_agents.map((agent) => (
                <Badge
                  key={agent}
                  variant="outline"
                  className="text-xs font-medium border-teal/30 bg-teal/10 text-teal"
                >
                  {agent}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Trending in This Stack */}
        {ecosystem.trending_tools.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Trending in This Stack
            </div>
            <ul className="space-y-1.5">
              {ecosystem.trending_tools.map((tool) => (
                <li key={tool.name} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-teal/60" />
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">{tool.name}</span>
                    {" \u2014 "}
                    {tool.relevance}
                  </span>
                  {tool.url && (
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground/50 hover:text-teal transition-colors"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
