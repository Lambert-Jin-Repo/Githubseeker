const BRAVE_API_URL = "https://api.search.brave.com/res/v1/web/search";

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

export async function braveSearch(
  query: string,
  count: number = 10
): Promise<BraveSearchResult[]> {
  const response = await fetch(
    `${BRAVE_API_URL}?q=${encodeURIComponent(query)}&count=${count}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY!,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Brave Search API error: ${response.status}`);
  }

  const data = await response.json();
  return (data.web?.results || []).map((r: Record<string, string>) => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }));
}

export async function fetchWebPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "GitHubScout/1.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
  const html = await response.text();
  // Return first 50k chars to stay within context limits
  return html.slice(0, 50000);
}
