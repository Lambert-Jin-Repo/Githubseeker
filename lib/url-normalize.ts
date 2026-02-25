import type { RepoResult } from "./types";

export function normalizeGitHubUrl(url: string): string {
  let normalized = url.trim();
  normalized = normalized.replace(/^http:/, "https:");
  normalized = normalized.replace("://www.", "://");
  normalized = normalized.replace(/\/+$/, "");
  normalized = normalized.replace(/\/tree\/(main|master).*$/, "");
  normalized = normalized.replace(/\/blob\/(main|master).*$/, "");

  const match = normalized.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)/);
  if (match) {
    return `https://github.com/${match[1].toLowerCase()}/${match[2].toLowerCase()}`;
  }
  return normalized;
}

export function deduplicateRepos(repos: RepoResult[]): RepoResult[] {
  const seen = new Map<string, RepoResult>();

  for (const repo of repos) {
    const normalized = normalizeGitHubUrl(repo.repo_url);
    const existing = seen.get(normalized);

    if (existing) {
      const mergedStrategies = [
        ...new Set([...existing.source_strategies, ...repo.source_strategies]),
      ];
      const better = repo.quality_tier < existing.quality_tier ? repo : existing;
      seen.set(normalized, { ...better, source_strategies: mergedStrategies, repo_url: normalized });
    } else {
      seen.set(normalized, { ...repo, repo_url: normalized });
    }
  }

  return Array.from(seen.values());
}
