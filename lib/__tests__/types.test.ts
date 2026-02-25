import { describe, it, expect } from "vitest";
import type { ScoutMode, QualityTier, RepoResult } from "../types";

describe("Type contracts", () => {
  it("ScoutMode values are valid", () => {
    const modes: ScoutMode[] = ["LEARN", "BUILD", "SCOUT"];
    expect(modes).toHaveLength(3);
  });

  it("QualityTier values are valid", () => {
    const tiers: QualityTier[] = [1, 2, 3];
    expect(tiers).toHaveLength(3);
  });

  it("RepoResult can be constructed", () => {
    const repo: RepoResult = {
      repo_url: "https://github.com/test/repo",
      repo_name: "test/repo",
      stars: 100,
      last_commit: "2026-01-01",
      primary_language: "TypeScript",
      license: "MIT",
      quality_tier: 1,
      verification: {
        existence: { status: "live", checked_at: new Date().toISOString() },
        stars: { value: 100, level: "verified", source: "github" },
        last_commit: { value: "2026-01-01", level: "verified" },
        language: { value: "TypeScript", level: "verified" },
        license: { value: "MIT", level: "verified" },
        freshness: { status: "active", level: "verified" },
        community: { signal: "no_data", level: "unverified" },
      },
      reddit_signal: "no_data",
      summary: "Test repo",
      source_strategies: ["high_star"],
      is_selected: false,
    };
    expect(repo.repo_name).toBe("test/repo");
  });
});
