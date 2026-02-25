import { describe, it, expect } from "vitest";
import { normalizeGitHubUrl, deduplicateRepos } from "../url-normalize";

describe("normalizeGitHubUrl", () => {
  it("strips trailing slashes", () => {
    expect(normalizeGitHubUrl("https://github.com/owner/repo/")).toBe(
      "https://github.com/owner/repo"
    );
  });

  it("removes /tree/main suffix", () => {
    expect(
      normalizeGitHubUrl("https://github.com/owner/repo/tree/main")
    ).toBe("https://github.com/owner/repo");
  });

  it("removes /tree/master suffix", () => {
    expect(
      normalizeGitHubUrl("https://github.com/owner/repo/tree/master")
    ).toBe("https://github.com/owner/repo");
  });

  it("removes www prefix", () => {
    expect(normalizeGitHubUrl("https://www.github.com/owner/repo")).toBe(
      "https://github.com/owner/repo"
    );
  });

  it("ensures https", () => {
    expect(normalizeGitHubUrl("http://github.com/owner/repo")).toBe(
      "https://github.com/owner/repo"
    );
  });

  it("lowercases owner/repo", () => {
    expect(normalizeGitHubUrl("https://github.com/Owner/Repo")).toBe(
      "https://github.com/owner/repo"
    );
  });

  it("handles blob paths", () => {
    expect(
      normalizeGitHubUrl(
        "https://github.com/owner/repo/blob/main/README.md"
      )
    ).toBe("https://github.com/owner/repo");
  });
});

describe("deduplicateRepos", () => {
  it("removes duplicate repos by normalized URL", () => {
    const repos = [
      makeRepo("https://github.com/owner/repo", ["high_star"], 1),
      makeRepo("https://github.com/Owner/Repo/", ["awesome_list"], 2),
    ];

    const result = deduplicateRepos(repos);
    expect(result).toHaveLength(1);
    expect(result[0].source_strategies).toContain("high_star");
    expect(result[0].source_strategies).toContain("awesome_list");
  });

  it("keeps higher quality tier on dedup", () => {
    const repos = [
      makeRepo("https://github.com/owner/repo", ["high_star"], 2),
      makeRepo("https://github.com/owner/repo", ["awesome_list"], 1),
    ];

    const result = deduplicateRepos(repos);
    expect(result).toHaveLength(1);
    expect(result[0].quality_tier).toBe(1);
  });

  it("preserves unique repos", () => {
    const repos = [
      makeRepo("https://github.com/owner/repo1", ["high_star"], 1),
      makeRepo("https://github.com/owner/repo2", ["awesome_list"], 2),
    ];

    const result = deduplicateRepos(repos);
    expect(result).toHaveLength(2);
  });
});

function makeRepo(url: string, strategies: string[], tier: 1 | 2 | 3) {
  return {
    repo_url: url,
    repo_name: url.split("github.com/")[1] || "unknown",
    stars: 100,
    last_commit: "2026-01-01",
    primary_language: "TypeScript",
    license: "MIT",
    quality_tier: tier,
    verification: {} as any,
    reddit_signal: "no_data" as const,
    summary: "Test",
    source_strategies: strategies,
    is_selected: false,
  };
}
