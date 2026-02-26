import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock web-search module
vi.mock("../web-search", () => ({
  fetchWebPage: vi.fn(),
  webSearch: vi.fn(),
}));

import { fetchRepoData, type RawRepoData } from "../repo-data-fetcher";
import { fetchWebPage, webSearch } from "../web-search";

const mockedFetch = vi.mocked(fetchWebPage);
const mockedSearch = vi.mocked(webSearch);

describe("fetchRepoData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetch.mockResolvedValue("<html>mock page</html>");
    mockedSearch.mockResolvedValue([]);
  });

  it("fetches all data sources in parallel and returns RawRepoData", async () => {
    const result = await fetchRepoData("https://github.com/vercel/next.js");

    expect(result.repoUrl).toBe("https://github.com/vercel/next.js");
    expect(result.repoPageHtml).toBe("<html>mock page</html>");
    // Should have called fetchWebPage for repo page, README, tree, and dep file
    expect(mockedFetch).toHaveBeenCalledTimes(4);
    // Should have called webSearch for community context
    expect(mockedSearch).toHaveBeenCalledTimes(1);
  });

  it("handles fetch failures gracefully with null", async () => {
    mockedFetch.mockRejectedValue(new Error("Network error"));
    mockedSearch.mockRejectedValue(new Error("Search failed"));

    const result = await fetchRepoData("https://github.com/test/repo");

    expect(result.repoUrl).toBe("https://github.com/test/repo");
    expect(result.repoPageHtml).toBeNull();
    expect(result.readmeContent).toBeNull();
    expect(result.treeContent).toBeNull();
    expect(result.depsContent).toBeNull();
    expect(result.communityResults).toEqual([]);
  });

  it("extracts owner/repo from URL correctly", async () => {
    await fetchRepoData("https://github.com/facebook/react");

    // Should fetch README at correct URL
    expect(mockedFetch).toHaveBeenCalledWith(
      expect.stringContaining("facebook/react")
    );
  });
});

describe("fetchAllReposData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetch.mockResolvedValue("<html>mock</html>");
    mockedSearch.mockResolvedValue([]);
  });

  it("fetches data for multiple repos in parallel", async () => {
    const { fetchAllReposData } = await import("../repo-data-fetcher");
    const urls = [
      "https://github.com/vercel/next.js",
      "https://github.com/facebook/react",
    ];

    const results = await fetchAllReposData(urls);

    expect(results).toHaveLength(2);
    expect(results[0].repoUrl).toBe("https://github.com/vercel/next.js");
    expect(results[1].repoUrl).toBe("https://github.com/facebook/react");
  });
});
