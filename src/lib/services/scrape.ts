import { scrapeFirecrawl } from "./firecrawl";

// MVP: single Firecrawl tier. Post-MVP: `?? scrapeWayback(url) ?? scrapePaidProxy(url)`.
export async function scrapeContent(url: string): Promise<string | null> {
  return scrapeFirecrawl(url);
}
