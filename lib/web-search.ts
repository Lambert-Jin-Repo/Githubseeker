import { logSerperCall, logGitHubFetch } from "./api-logger";

const SERPER_API_URL = "https://google.serper.dev/search";

export interface WebSearchResult {
  title: string;
  url: string;
  description: string;
}

export async function webSearch(
  query: string,
  count: number = 20,
  searchId?: string
): Promise<WebSearchResult[]> {
  const startTime = performance.now();
  let response: Response;
  try {
    response = await fetch(SERPER_API_URL, {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: count }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startTime);
    if (searchId) {
      logSerperCall({ search_id: searchId, query, success: false, latency_ms: latencyMs, error_type: "network" });
    }
    throw err;
  }

  if (!response.ok) {
    const latencyMs = Math.round(performance.now() - startTime);
    const body = await response.text().catch(() => "");
    if (searchId) {
      logSerperCall({ search_id: searchId, query, success: false, latency_ms: latencyMs, error_type: "http_" + response.status });
    }
    throw new Error(`Serper API error: ${response.status} ${body}`.trim());
  }

  const data = await response.json();
  const results: WebSearchResult[] = (data.organic || []).map((r: Record<string, string>) => ({
    title: r.title,
    url: r.link,
    description: r.snippet,
  }));

  const latencyMs = Math.round(performance.now() - startTime);
  if (searchId) {
    logSerperCall({ search_id: searchId, query, success: true, latency_ms: latencyMs });
  }

  return results;
}

export interface GitHubMetadata {
  url: string;
  description: string | null;
  stars: number | null;
  language: string | null;
  license: string | null;
  lastCommit: string | null;
  topics: string[];
  archived: boolean;
}

/**
 * Fetch a top-level GitHub repo page and extract structured metadata via regex.
 * Returns ~300 bytes of JSON instead of 50KB raw HTML.
 */
export async function fetchGitHubMetadata(url: string, searchId?: string): Promise<GitHubMetadata> {
  const startTime = performance.now();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": "GitHubScout/1.0" },
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startTime);
    if (searchId) {
      logGitHubFetch({ search_id: searchId, url, success: false, latency_ms: latencyMs, error_type: "network" });
    }
    throw err;
  }
  if (!response.ok) {
    const latencyMs = Math.round(performance.now() - startTime);
    if (searchId) {
      logGitHubFetch({ search_id: searchId, url, success: false, latency_ms: latencyMs, error_type: "http_" + response.status });
    }
    throw new Error(`GitHub fetch failed: ${response.status}`);
  }
  const html = await response.text();

  // Stars — e.g. "1,234" or "12.5k" in the star button area
  const starsMatch = html.match(/id="repo-stars-counter-star"[^>]*>([^<]+)</);
  let stars: number | null = null;
  if (starsMatch) {
    const raw = starsMatch[1].trim().toLowerCase().replace(/,/g, "");
    if (raw.endsWith("k")) {
      stars = Math.round(parseFloat(raw) * 1000);
    } else {
      stars = parseInt(raw, 10) || null;
    }
  }

  // Description — og:description meta tag
  const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*?)"\s*\/?>/);
  const description = descMatch ? descMatch[1].trim() || null : null;

  // Language — most common in the language stats bar
  const langMatch = html.match(/itemprop="programmingLanguage">([^<]+)</);
  const language = langMatch ? langMatch[1].trim() : null;

  // License — e.g. "MIT license" in the sidebar
  const licenseMatch = html.match(/License<\/span>\s*<span[^>]*>([^<]+)</);
  const license = licenseMatch ? licenseMatch[1].trim() : null;

  // Last commit — relative-time tag
  const commitMatch = html.match(/<relative-time[^>]*datetime="([^"]+)"/);
  const lastCommit = commitMatch ? commitMatch[1] : null;

  // Topics — data-octo-click="topic_click"
  const topicRegex = /data-octo-click="topic_click"[^>]*>([^<]+)</g;
  const topics: string[] = [];
  let topicMatch;
  while ((topicMatch = topicRegex.exec(html)) !== null) {
    topics.push(topicMatch[1].trim());
  }

  // Archived banner
  const archived = html.includes("This repository has been archived");

  const latencyMs = Math.round(performance.now() - startTime);
  if (searchId) {
    logGitHubFetch({ search_id: searchId, url, success: true, latency_ms: latencyMs });
  }

  return { url, description, stars, language, license, lastCommit, topics, archived };
}

export async function fetchWebPage(url: string, searchId?: string): Promise<string> {
  const startTime = performance.now();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": "GitHubScout/1.0" },
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startTime);
    if (searchId) {
      logGitHubFetch({ search_id: searchId, url, success: false, latency_ms: latencyMs, error_type: "network" });
    }
    throw err;
  }
  if (!response.ok) {
    const latencyMs = Math.round(performance.now() - startTime);
    if (searchId) {
      logGitHubFetch({ search_id: searchId, url, success: false, latency_ms: latencyMs, error_type: "http_" + response.status });
    }
    throw new Error(`Fetch failed: ${response.status}`);
  }
  const html = await response.text();
  const latencyMs = Math.round(performance.now() - startTime);
  if (searchId) {
    logGitHubFetch({ search_id: searchId, url, success: true, latency_ms: latencyMs });
  }
  return html.slice(0, 50000);
}
