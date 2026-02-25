"use client";

import { ExternalLink, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScoutStore } from "@/stores/scout-store";

export function IndustryToolsSection() {
  const industryTools = useScoutStore((s) => s.industryTools);

  if (industryTools.length === 0) return null;

  return (
    <Card className="animate-slide-up border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="size-4 text-muted-foreground" />
          <span className="font-serif">Industry Tools</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {industryTools.map((tool, idx) => (
            <li
              key={`${tool.name}-${idx}`}
              className="animate-slide-in"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              {tool.url ? (
                <a
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 rounded-md p-2 -mx-2 transition-colors hover:bg-secondary/60"
                >
                  <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground group-hover:text-teal transition-colors" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground group-hover:text-teal transition-colors">
                      {tool.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {tool.description}
                    </p>
                  </div>
                </a>
              ) : (
                <div className="flex items-start gap-3 p-2 -mx-2">
                  <Wrench className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {tool.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {tool.description}
                    </p>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
