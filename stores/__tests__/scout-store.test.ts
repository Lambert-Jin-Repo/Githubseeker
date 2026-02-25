import { describe, it, expect, beforeEach } from "vitest";
import { useScoutStore } from "../scout-store";

describe("ScoutStore", () => {
  beforeEach(() => {
    useScoutStore.getState().reset();
  });

  it("starts with empty state", () => {
    const state = useScoutStore.getState();
    expect(state.repos).toEqual([]);
    expect(state.mode).toBeNull();
    expect(state.isSearching).toBe(false);
    expect(state.phase1Complete).toBe(false);
    expect(state.phase2Complete).toBe(false);
  });

  it("sets mode", () => {
    useScoutStore.getState().setMode("LEARN");
    expect(useScoutStore.getState().mode).toBe("LEARN");
  });

  it("adds repos", () => {
    const repo = makeRepo("https://github.com/test/repo");
    useScoutStore.getState().addRepo(repo);
    expect(useScoutStore.getState().repos).toHaveLength(1);
    expect(useScoutStore.getState().repos[0].repo_name).toBe("test/repo");
  });

  it("updates repo verification in-place", () => {
    const repo = makeRepo("https://github.com/test/repo");
    useScoutStore.getState().addRepo(repo);
    useScoutStore.getState().updateRepoVerification("https://github.com/test/repo", {
      existence: { status: "live", checked_at: new Date().toISOString() },
    } as any);
    const updated = useScoutStore.getState().repos[0];
    expect(updated.verification.existence.status).toBe("live");
  });

  it("adds search progress", () => {
    useScoutStore.getState().addSearchProgress({ strategy: "high_star", status: "running", repos_found: 0 });
    expect(useScoutStore.getState().searchProgress).toHaveLength(1);

    // Update same strategy
    useScoutStore.getState().addSearchProgress({ strategy: "high_star", status: "complete", repos_found: 8 });
    expect(useScoutStore.getState().searchProgress).toHaveLength(1);
    expect(useScoutStore.getState().searchProgress[0].repos_found).toBe(8);
  });

  it("toggles repo selection with max 5 limit", () => {
    for (let i = 0; i < 7; i++) {
      useScoutStore.getState().addRepo(makeRepo(`https://github.com/test/repo${i}`));
    }

    const store = useScoutStore.getState();
    for (let i = 0; i < 5; i++) {
      store.toggleRepoSelection(`https://github.com/test/repo${i}`);
    }
    expect(useScoutStore.getState().selectedRepoUrls).toHaveLength(5);

    // 6th selection should not go through
    useScoutStore.getState().toggleRepoSelection("https://github.com/test/repo5");
    expect(useScoutStore.getState().selectedRepoUrls).toHaveLength(5);

    // Deselecting works
    useScoutStore.getState().toggleRepoSelection("https://github.com/test/repo0");
    expect(useScoutStore.getState().selectedRepoUrls).toHaveLength(4);
  });

  it("adds observations", () => {
    useScoutStore.getState().addObservation("Pattern found");
    expect(useScoutStore.getState().observations).toEqual(["Pattern found"]);
  });

  it("resets state", () => {
    useScoutStore.getState().setMode("LEARN");
    useScoutStore.getState().addObservation("test");
    useScoutStore.getState().reset();
    expect(useScoutStore.getState().mode).toBeNull();
    expect(useScoutStore.getState().observations).toEqual([]);
  });
});

function makeRepo(url: string) {
  return {
    repo_url: url,
    repo_name: url.replace("https://github.com/", ""),
    stars: 100,
    last_commit: "2026-01-01",
    primary_language: "TypeScript",
    license: "MIT",
    quality_tier: 1 as const,
    verification: {} as any,
    reddit_signal: "no_data" as const,
    summary: "Test",
    source_strategies: ["high_star"],
    is_selected: false,
  };
}
