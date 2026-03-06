/**
 * Agent ecosystem batch search — discovers agent-related files
 * (.cursorrules, mcp.json, skills.yaml, etc.) across multiple repos
 * in a single Serper query.
 */

import { webSearch, fetchWebPage } from "@/lib/web-search";
import type { AgentEcosystemDiscovery } from "@/lib/types";

// ── Constants ────────────────────────────────────────────────────

export const AGENT_FILE_PATTERNS = [".cursorrules", "mcp.json", "skills.yaml", ".claude"];

export const AGENT_FILE_TYPE_MAP: Record<string, AgentEcosystemDiscovery["discovered_files"][number]["type"]> = {
  ".cursorrules": "cursorrules",
  "mcp.json": "mcp_config",
  "skills.yaml": "claude_skills",
  ".claude": "claude_skills",
  "agents.yaml": "agents_config",
  "agents.json": "agents_config",
};

// ── Types ────────────────────────────────────────────────────────

export interface AgentEcosystemRaw {
  fileUrls: Array<{ type: string; url: string; path: string }>;
  fileContents: Map<string, string>;
  trendingResults: Array<{ title: string; url: string; description: string }>;
}

// ── Batch search function ────────────────────────────────────────

export async function batchSearchAgentEcosystem(
  repos: Array<{ owner: string; repo: string; repoUrl: string }>,
  searchId?: string,
): Promise<Map<string, AgentEcosystemRaw>> {
  const result = new Map<string, AgentEcosystemRaw>();

  if (repos.length === 0) return result;

  // Initialize entries for all repos
  for (const r of repos) {
    result.set(r.repoUrl, { fileUrls: [], fileContents: new Map(), trendingResults: [] });
  }

  try {
    // Build a single Serper query for all repos
    const repoTerms = repos
      .slice(0, 6)
      .map((r) => `"${r.owner}/${r.repo}"`)
      .join(" OR ");
    const fileTerms = AGENT_FILE_PATTERNS.map((f) => `"${f}"`).join(" OR ");
    const query = `site:github.com (${fileTerms}) ${repoTerms}`;

    const searchResults = await webSearch(query, 20, searchId);

    for (const hit of searchResults) {
      const matchedRepo = repos.find(
        (r) => hit.url.includes(`${r.owner}/${r.repo}`)
      );
      if (!matchedRepo) continue;

      const matchedPattern = AGENT_FILE_PATTERNS.find((p) => hit.url.includes(p) || hit.title.includes(p));
      if (!matchedPattern) continue;

      const entry = result.get(matchedRepo.repoUrl)!;
      const pathFromUrl = hit.url.split("/blob/")[1]?.split("/").slice(1).join("/") || matchedPattern;
      entry.fileUrls.push({
        type: AGENT_FILE_TYPE_MAP[matchedPattern] || "other",
        url: hit.url,
        path: pathFromUrl,
      });
    }

    // Fetch discovered file contents in parallel (max 3 files per repo)
    const fetchPromises: Array<Promise<void>> = [];
    for (const [, data] of result) {
      for (const file of data.fileUrls.slice(0, 3)) {
        const rawUrl = file.url
          .replace("github.com", "raw.githubusercontent.com")
          .replace("/blob/", "/");
        fetchPromises.push(
          fetchWebPage(rawUrl, searchId)
            .then((content) => {
              data.fileContents.set(file.path, content.slice(0, 3000));
            })
            .catch(() => {
              // Silently skip failed fetches
            })
        );
      }
    }
    await Promise.allSettled(fetchPromises);

    return result;
  } catch (err) {
    console.error("[agent-ecosystem] Batch search failed:", err instanceof Error ? err.message : err);
    return result;
  }
}

// ── Ecosystem context builder ────────────────────────────────────

export function buildEcosystemContext(
  ecosystemData: AgentEcosystemRaw | undefined,
): string | undefined {
  if (!ecosystemData || ecosystemData.fileUrls.length === 0) return undefined;
  const contextParts: string[] = [];
  for (const file of ecosystemData.fileUrls) {
    const content = ecosystemData.fileContents.get(file.path);
    contextParts.push(
      `File: ${file.path} (${file.type})\nURL: ${file.url}${content ? `\nContent:\n${content}` : ""}`,
    );
  }
  return contextParts.join("\n---\n");
}
