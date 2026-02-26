const SERPER_API_URL = "https://google.serper.dev/search";

export interface WebSearchResult {
  title: string;
  url: string;
  description: string;
}

export async function webSearch(
  query: string,
  count: number = 10
): Promise<WebSearchResult[]> {
  const response = await fetch(SERPER_API_URL, {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: count }),
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.status}`);
  }

  const data = await response.json();
  return (data.organic || []).map((r: Record<string, string>) => ({
    title: r.title,
    url: r.link,
    description: r.snippet,
  }));
}

export async function fetchWebPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "GitHubScout/1.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
  const html = await response.text();
  return html.slice(0, 50000);
}
