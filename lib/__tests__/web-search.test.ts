import { describe, it, expect, vi, beforeEach } from "vitest";
import { webSearch, fetchGitHubMetadata, type GitHubMetadata } from "../web-search";

describe("webSearch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to 20 results per query", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ organic: [] }),
    }));

    await webSearch("test query");

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"num":20'),
      })
    );
  });

  it("allows overriding result count", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ organic: [] }),
    }));

    await webSearch("test query", 5);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"num":5'),
      })
    );
  });
});

// Minimal GitHub HTML fixture with metadata markers
function buildGitHubHtml(overrides: Partial<{
  stars: string;
  description: string;
  language: string;
  license: string;
  lastCommit: string;
  topics: string[];
  archived: boolean;
}> = {}): string {
  const {
    stars = "1,234",
    description = "A great repo",
    language = "TypeScript",
    license = "MIT",
    lastCommit = "2026-01-15T10:00:00Z",
    topics = ["web", "framework"],
    archived = false,
  } = overrides;

  const topicTags = topics
    .map((t) => `<a data-octo-click="topic_click" class="topic-tag">${t}</a>`)
    .join("\n");

  return `
<html>
<head>
  <meta property="og:description" content="${description}" />
</head>
<body>
  ${archived ? '<div class="flash">This repository has been archived</div>' : ""}
  <span id="repo-stars-counter-star">${stars}</span>
  <span itemprop="programmingLanguage">${language}</span>
  <span>License</span> <span class="Link--muted">${license}</span>
  <relative-time datetime="${lastCommit}">Jan 15</relative-time>
  ${topicTags}
</body>
</html>`;
}

describe("fetchGitHubMetadata", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts all metadata fields from GitHub HTML", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(buildGitHubHtml()),
    }));

    const meta = await fetchGitHubMetadata("https://github.com/owner/repo");

    expect(meta.url).toBe("https://github.com/owner/repo");
    expect(meta.stars).toBe(1234);
    expect(meta.description).toBe("A great repo");
    expect(meta.language).toBe("TypeScript");
    expect(meta.license).toBe("MIT");
    expect(meta.lastCommit).toBe("2026-01-15T10:00:00Z");
    expect(meta.topics).toEqual(["web", "framework"]);
    expect(meta.archived).toBe(false);
  });

  it("parses 'k' star counts correctly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(buildGitHubHtml({ stars: "12.5k" })),
    }));

    const meta = await fetchGitHubMetadata("https://github.com/owner/repo");
    expect(meta.stars).toBe(12500);
  });

  it("detects archived repos", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(buildGitHubHtml({ archived: true })),
    }));

    const meta = await fetchGitHubMetadata("https://github.com/owner/repo");
    expect(meta.archived).toBe(true);
  });

  it("returns nulls for missing fields gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("<html><body>Minimal page</body></html>"),
    }));

    const meta = await fetchGitHubMetadata("https://github.com/owner/repo");

    expect(meta.stars).toBeNull();
    expect(meta.description).toBeNull();
    expect(meta.language).toBeNull();
    expect(meta.license).toBeNull();
    expect(meta.lastCommit).toBeNull();
    expect(meta.topics).toEqual([]);
    expect(meta.archived).toBe(false);
  });

  it("throws on 404 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));

    await expect(
      fetchGitHubMetadata("https://github.com/owner/nonexistent")
    ).rejects.toThrow("GitHub fetch failed: 404");
  });

  it("throws on timeout (AbortError)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(
      new DOMException("The operation was aborted", "AbortError")
    ));

    await expect(
      fetchGitHubMetadata("https://github.com/slow/repo")
    ).rejects.toThrow("aborted");
  });
});
