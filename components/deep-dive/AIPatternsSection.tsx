"use client";

import {
  Bot,
  Cpu,
  FileCode2,
  Network,
  MessageSquareCode,
  CircleDot,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfidenceIndicator } from "./ConfidenceIndicator";
import type { AIPatterns } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AIPatternsSectionProps {
  patterns: AIPatterns;
}

export function AIPatternsSection({ patterns }: AIPatternsSectionProps) {
  if (!patterns.has_ai_components) {
    return (
      <div className="space-y-3">
        <h4 className="font-serif text-lg text-foreground">AI Patterns</h4>
        <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-6 text-center">
          <Bot className="mx-auto mb-2 size-5 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No AI patterns detected in this repository.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h4 className="font-serif text-lg text-foreground">
          <span className="text-teal">AI</span> Patterns
        </h4>
        <ConfidenceIndicator confidence={patterns.confidence} />
      </div>

      <div className="rounded-lg border border-teal/20 bg-teal/[0.03] p-4 space-y-5">
        {/* SDKs Detected */}
        {patterns.sdks_detected.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Cpu className="size-3.5" />
              SDKs Detected
            </div>
            <div className="flex flex-wrap gap-1.5">
              {patterns.sdks_detected.map((sdk) => (
                <Badge
                  key={sdk}
                  variant="outline"
                  className="border-teal/30 bg-teal/[0.06] text-teal font-normal text-xs"
                >
                  {sdk}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Architecture Pattern */}
        {patterns.agent_architecture && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Network className="size-3.5" />
              Architecture Pattern
            </div>
            <Badge className="bg-teal text-white text-sm font-medium px-3 py-1">
              {patterns.agent_architecture}
            </Badge>
          </div>
        )}

        {/* Skill Files Found */}
        {patterns.skill_files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <FileCode2 className="size-3.5" />
              Skill Files Found
            </div>
            <ul className="space-y-1">
              {patterns.skill_files.map((file) => (
                <li
                  key={file}
                  className="flex items-center gap-1.5 text-sm font-mono text-muted-foreground"
                >
                  <CircleDot className="size-2.5 shrink-0 text-teal/50" />
                  {file}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* MCP Usage */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            MCP Usage
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-medium",
              patterns.mcp_usage
                ? "border-teal/30 bg-teal/10 text-teal"
                : "border-border bg-muted/50 text-muted-foreground"
            )}
          >
            {patterns.mcp_usage ? "Yes" : "No"}
          </Badge>
        </div>

        {/* Prompt Engineering */}
        {(patterns.prompt_engineering.has_system_prompts ||
          patterns.prompt_engineering.has_few_shot ||
          patterns.prompt_engineering.prompt_location) && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <MessageSquareCode className="size-3.5" />
              Prompt Engineering
            </div>
            <div className="space-y-1.5 text-sm text-muted-foreground">
              {patterns.prompt_engineering.has_system_prompts && (
                <div className="flex items-center gap-2">
                  <span className="inline-block size-1.5 rounded-full bg-teal/60" />
                  System prompts detected
                </div>
              )}
              {patterns.prompt_engineering.has_few_shot && (
                <div className="flex items-center gap-2">
                  <span className="inline-block size-1.5 rounded-full bg-teal/60" />
                  Few-shot examples found
                </div>
              )}
              {patterns.prompt_engineering.prompt_location && (
                <div className="flex items-center gap-2">
                  <span className="inline-block size-1.5 rounded-full bg-teal/60" />
                  <span>
                    Location:{" "}
                    <code className="rounded bg-secondary/80 px-1.5 py-0.5 font-mono text-xs">
                      {patterns.prompt_engineering.prompt_location}
                    </code>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Summary */}
        {patterns.summary && (
          <div className="border-t border-teal/10 pt-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {patterns.summary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
