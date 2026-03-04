"use client";

import { Download, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { RepoResult, DeepDiveResult } from "@/lib/types";

interface ExportButtonProps {
  repos: RepoResult[];
  deepDiveResults?: DeepDiveResult[];
  query: string;
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function tierLabel(tier: 1 | 2 | 3): string {
  if (tier === 1) return "Tier 1";
  if (tier === 2) return "Tier 2";
  return "Tier 3";
}

function exportAsJSON(
  repos: RepoResult[],
  deepDiveResults: DeepDiveResult[] | undefined,
  query: string
) {
  const data = {
    query,
    exported_at: new Date().toISOString(),
    repos: repos.map((r) => ({
      repo_name: r.repo_name,
      repo_url: r.repo_url,
      stars: r.stars,
      primary_language: r.primary_language,
      license: r.license,
      last_commit: r.last_commit,
      quality_tier: r.quality_tier,
      summary: r.summary,
      source_strategies: r.source_strategies,
    })),
    ...(deepDiveResults && deepDiveResults.length > 0
      ? { deep_dive_results: deepDiveResults }
      : {}),
  };

  const content = JSON.stringify(data, null, 2);
  triggerDownload(
    content,
    `scout-${sanitizeFilename(query)}.json`,
    "application/json"
  );
  toast.success("Exported as JSON");
}

function exportAsCSV(repos: RepoResult[], query: string) {
  const headers = [
    "repo_name",
    "url",
    "stars",
    "language",
    "quality_tier",
    "summary",
  ];
  const rows = repos.map((r) => [
    escapeCsvField(r.repo_name),
    escapeCsvField(r.repo_url),
    r.stars !== null ? String(r.stars) : "",
    escapeCsvField(r.primary_language ?? ""),
    tierLabel(r.quality_tier),
    escapeCsvField(r.summary),
  ]);

  const content = [headers.join(","), ...rows.map((row) => row.join(","))].join(
    "\n"
  );

  triggerDownload(
    content,
    `scout-${sanitizeFilename(query)}.csv`,
    "text/csv"
  );
  toast.success("Exported as CSV");
}

function exportAsMarkdown(
  repos: RepoResult[],
  deepDiveResults: DeepDiveResult[] | undefined,
  query: string
) {
  const lines: string[] = [];

  lines.push(`# GitHub Scout Report`);
  lines.push("");
  lines.push(`**Query:** ${query}`);
  lines.push(`**Date:** ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`);
  lines.push(`**Repos Found:** ${repos.length}`);
  lines.push("");

  // Repos table
  lines.push("## Repositories");
  lines.push("");
  lines.push("| Repository | Stars | Language | Tier | Summary |");
  lines.push("|---|---|---|---|---|");

  for (const r of repos) {
    const stars = r.stars !== null ? r.stars.toLocaleString() : "-";
    const lang = r.primary_language ?? "-";
    const summary = r.summary.replace(/\|/g, "\\|");
    lines.push(
      `| [${r.repo_name}](${r.repo_url}) | ${stars} | ${lang} | ${tierLabel(r.quality_tier)} | ${summary} |`
    );
  }

  // Deep dive sections
  if (deepDiveResults && deepDiveResults.length > 0) {
    lines.push("");
    lines.push("## Deep Dive Analysis");

    for (const dd of deepDiveResults) {
      lines.push("");
      lines.push(`### ${dd.repo_name}`);
      lines.push("");
      lines.push(
        `**Stars:** ${dd.stars.toLocaleString()} | **Language:** ${dd.primary_language} | **License:** ${dd.license}`
      );
      lines.push("");

      if (dd.what_it_does) {
        lines.push("#### What It Does");
        lines.push("");
        lines.push(dd.what_it_does.content);
        lines.push("");
      }

      if (dd.why_it_stands_out) {
        lines.push("#### Why It Stands Out");
        lines.push("");
        lines.push(dd.why_it_stands_out.content);
        lines.push("");
      }

      if (dd.tech_stack) {
        lines.push("#### Tech Stack");
        lines.push("");
        if (dd.tech_stack.languages.length > 0) {
          lines.push(`- **Languages:** ${dd.tech_stack.languages.join(", ")}`);
        }
        if (dd.tech_stack.frameworks.length > 0) {
          lines.push(
            `- **Frameworks:** ${dd.tech_stack.frameworks.join(", ")}`
          );
        }
        if (dd.tech_stack.infrastructure.length > 0) {
          lines.push(
            `- **Infrastructure:** ${dd.tech_stack.infrastructure.join(", ")}`
          );
        }
        lines.push("");
      }
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("*Generated by GitHub Scout*");

  const content = lines.join("\n");
  triggerDownload(
    content,
    `scout-${sanitizeFilename(query)}.md`,
    "text/markdown"
  );
  toast.success("Exported as Markdown");
}

export function ExportButton({
  repos,
  deepDiveResults,
  query,
}: ExportButtonProps) {
  if (repos.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
          data-export-trigger="true"
        >
          <Download className="size-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => exportAsJSON(repos, deepDiveResults, query)}
        >
          <FileJson className="size-4" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportAsCSV(repos, query)}>
          <FileSpreadsheet className="size-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => exportAsMarkdown(repos, deepDiveResults, query)}
        >
          <FileText className="size-4" />
          Export as Markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
