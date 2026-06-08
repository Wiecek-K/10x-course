import { FIRECRAWL_API_KEY } from "astro:env/server";
import firecrawlFixture from "./__fixtures__/firecrawl-response.md?raw";
import { isMockMode } from "./mock";

interface FirecrawlScrapeResponse {
  data: {
    markdown: string | null;
  };
}

export async function scrapeFirecrawl(url: string): Promise<string | null> {
  if (isMockMode()) {
    return firecrawlFixture || null;
  }

  if (!FIRECRAWL_API_KEY) return null;

  let response: Response;
  try {
    response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"] }),
    });
  } catch (err) {
    throw new Error(`Firecrawl network error: ${String(err)}`);
  }

  // Insufficient credits — definitive miss, no retry
  if (response.status === 402) return null;

  // Transient — let queue retry
  if (response.status === 429 || response.status >= 500) {
    throw new Error(`Firecrawl transient error: ${response.status}`);
  }

  if (!response.ok) return null;

  const raw: unknown = await response.json();
  const data = raw as FirecrawlScrapeResponse;
  return data.data.markdown ?? null;
}
