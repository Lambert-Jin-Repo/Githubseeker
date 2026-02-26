import { fetchWebPage, webSearch } from "@/lib/web-search";
import type { WebSearchResult } from "@/lib/web-search";

export interface RawRepoData {
  repoUrl: string;
  owner: string;
  repo: string;
  repoPageHtml: string | null;
  readmeContent: string | null;
  treeContent: string | null;
  depsContent: string | null;
  communityResults: WebSearchResult[];
}

function extractOwnerRepo(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  return match ? { owner: match[1], repo: match[2] } : { owner: "", repo: "" };
}

async function safeFetch(url: string): Promise<string | null> {
  try {
    return await fetchWebPage(url);
  } catch {
    return null;
  }
}

async function safeSearch(query: string): Promise<WebSearchResult[]> {
  try {
    return await webSearch(query, 5);
  } catch {
    return [];
  }
}

export async function fetchRepoData(repoUrl: string): Promise<RawRepoData> {
  const { owner, repo } = extractOwnerRepo(repoUrl);

  const [repoPageHtml, readmeContent, treeContent, depsContent, communityResults] =
    await Promise.all([
      safeFetch(repoUrl),
      safeFetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`),
      safeFetch(`${repoUrl}/tree/main`),
      safeFetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/package.json`)
        .then(async (r) => {
          if (r) return r;
          return (
            (await safeFetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/requirements.txt`)) ||
            (await safeFetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/go.mod`)) ||
            (await safeFetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/Cargo.toml`))
          );
        }),
      safeSearch(`${owner}/${repo} github review OR comparison OR alternatives`),
    ]);

  return {
    repoUrl,
    owner,
    repo,
    repoPageHtml,
    readmeContent,
    treeContent,
    depsContent,
    communityResults,
  };
}

export async function fetchAllReposData(repoUrls: string[]): Promise<RawRepoData[]> {
  const results = await Promise.allSettled(
    repoUrls.map((url) => fetchRepoData(url))
  );
  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          repoUrl: repoUrls[i],
          owner: "",
          repo: "",
          repoPageHtml: null,
          readmeContent: null,
          treeContent: null,
          depsContent: null,
          communityResults: [],
        }
  );
}
