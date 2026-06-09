# Firecrawl — Developer Reference

**URL:** https://firecrawl.dev / https://api.firecrawl.dev
**Type:** Cloud SaaS + open-source self-hosted option (AGPL-3.0)

---

## Pricing

| Plan | Price/month | Credits/month | Rate limit (/scrape) | Concurrent browsers |
|------|-------------|---------------|----------------------|---------------------|
| Free | $0 | 1,000 | 10 req/min | 2 |
| Hobby | $16 | 5,000 | 100 req/min | 5 |
| Standard | $83 | 100,000 | 500 req/min | 50 |
| Growth | $333 | 500,000 | 5,000 req/min | 100 |
| Scale | $599 | 1,000,000 | 7,500 req/min | 150 |

1 credit = 1 scraped page (base). Credit multipliers:
- JSON extraction mode: +4 credits per scrape
- Enhanced proxy: +4 credits per scrape
- YouTube audio extraction: +4 credits (total 5 per call)
- PDF parsing: +1 credit per PDF page
- AI summary/highlights/question formats: +credits (varies)

---

## Authentication

```
Header: Authorization: Bearer fc-YOUR-API-KEY
Header: Content-Type: application/json
```

API keys prefixed `fc-`. Obtain at https://www.firecrawl.dev/app/api-keys — free signup.

---

## Rate Limits

| Plan | /scrape | /crawl | /search | /map |
|------|---------|--------|---------|------|
| Free | **10 RPM** | 1 RPM | 5 RPM | 10 RPM |
| Hobby | 100 RPM | 15 RPM | 50 RPM | 100 RPM |
| Standard | 500 RPM | 50 RPM | 250 RPM | 500 RPM |

Rate limits are per team — all keys under one account share counters.

---

## Endpoint

**Base URL:** `https://api.firecrawl.dev/v2/`

| Method | Path | Cost |
|--------|------|------|
| POST | `/scrape` | 1 credit (base) |
| POST | `/crawl` | 1 credit per page crawled |
| POST | `/search` | 2 credits per 10 results |
| POST | `/map` | 1 credit |

**Scrape a page:**
```bash
curl -X POST "https://api.firecrawl.dev/v2/scrape" \
  -H "Authorization: Bearer fc-YOUR-API-KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "formats": ["markdown"]}'
```

**From Cloudflare Worker (raw fetch):**
```typescript
const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${env.FIRECRAWL_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ url: targetUrl, formats: ["markdown"] }),
});
const data = await res.json();
const markdown = data.data.markdown;
```

Firecrawl has an official [Cloudflare Workers quickstart](https://docs.firecrawl.dev/quickstarts/cloudflare-workers).

---

## Key Request Body Fields

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `url` | string (URI) | required | Target URL |
| `formats` | string[] | `["markdown"]` | Output formats to include |
| `onlyMainContent` | boolean | `true` | Strip nav/footer |
| `proxy` | `"basic"`, `"enhanced"`, `"auto"` | `"auto"` | Enhanced = +4 credits |
| `timeout` | integer (ms) | 60,000 | Range: 1,000–300,000 |
| `waitFor` | integer (ms) | 0 | Wait before capture |
| `mobile` | boolean | false | Mobile viewport |
| `headers` | object | — | Forward to target |
| `excludeTags` | string[] | — | Strip CSS selectors |

Supported `formats` values: `markdown`, `html`, `rawHtml`, `links`, `images`, `screenshot`, `json`, `summary`, `audio`, `video`.

---

## Response Shape

```json
{
  "success": true,
  "data": {
    "markdown": "# Title\n\nContent...",
    "html": null,
    "rawHtml": null,
    "links": [],
    "screenshot": null,
    "metadata": {
      "title": "Page Title",
      "description": "Meta description",
      "sourceURL": "https://example.com",
      "url": "https://example.com",
      "statusCode": 200,
      "credits_used": 1,
      "cache_state": "miss",
      "proxy_used": "auto"
    }
  }
}
```

Markdown at `data.data.markdown`. Only requested `formats` are populated; others are `null`.

---

## Error Behavior

```json
{ "success": false, "error": "string", "code": "string" }
```

| HTTP Code | Meaning |
|-----------|---------|
| `402` | Insufficient credits |
| `429` | Rate limit or concurrency throttled |
| `404` | Cache miss when `lockdown: true` or `minAge` set |
| `500` | Server error (`code: "UNKNOWN_ERROR"`) |

No `Retry-After` header documented for 429.

---

## YouTube URL Handling

```json
{ "url": "https://www.youtube.com/watch?v=VIDEO_ID", "formats": ["audio"] }
```

- `formats: ["audio"]` → `data.audio` = signed GCS MP3 URL (1-hour TTL), costs 5 credits
- `formats: ["markdown"]` → page Markdown (title, description, visible transcript if available)
- Works on Shorts URLs; cloud version handles anti-bot better than self-hosted

---

## Performance

- ~3s average response time (spider.cloud Feb 2026 benchmark — 2nd fastest after Spider)
- Official CF Workers integration documented and supported

---

## Self-Hosted / Open Source

- **GitHub:** github.com/firecrawl/firecrawl — AGPL-3.0
- Self-hosting runs full scraping engine on own infra
- Cloud-only features: Agent, enhanced proxy rotation, browser sandbox, SSO

---

## Key Differences vs Jina Reader / Crawl4AI

- **1,000 free pages/month** (Jina = unlimited tokens on free key at lower RPM; Crawl4AI = no public cloud)
- Response is **JSON envelope** — Markdown at `data.data.markdown` (extra nesting vs Jina's raw text)
- **CF Worker officially supported** — documented quickstart exists
- YouTube audio extraction built-in (`formats: ["audio"]`)
- AGPL-3.0 self-hosted option if budget allows infra
- Free tier caps at 1,000 pages/month — exhausted quickly under load
