"use client";

import { ExternalLink, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScoutStore } from "@/stores/scout-store";

export function CuratedListsSection() {
  const curatedLists = useScoutStore((s) => s.curatedLists);

  if (curatedLists.length === 0) return null;

  return (
    <Card className="animate-slide-up border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="size-4 text-teal" />
          <span className="font-serif">Curated Lists</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {curatedLists.map((list, idx) => (
            <li
              key={list.url}
              className="animate-slide-in"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <a
                href={list.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 rounded-md p-2 -mx-2 transition-colors hover:bg-secondary/60"
              >
                <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground group-hover:text-teal transition-colors" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-teal transition-colors">
                    {list.name}
                  </p>
                  {list.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {list.description}
                    </p>
                  )}
                </div>
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
