# Jina Reader (r.jina.ai) — Developer Reference

**URL:** https://r.jina.ai / https://jina.ai/reader
**Type:** Cloud SaaS — no infrastructure, single GET request

---

## Pricing

| Plan | Cost | Allocation | Notes |
|------|------|------------|-------|
| No API key | Free | N/A | 20 RPM, IP-tracked, no Search access |
| Free API key | Free | 10M tokens per key | 500 RPM, non-commercial, no credit card |
| Paid | ~$0.045–$0.05 / 1M tokens | Pay-as-you-go | Same RPM as free key; Stripe billing |
| Premium | ~$20+/month | 5,000 RPM | Higher concurrency; contact sales |

- 1 request consumes tokens proportional to output length
- Failed requests not charged
- One key covers all Jina products (Reader, Search, Embeddings, Reranker)

---

## Authentication

```
Header: Authorization: Bearer API_KEY   (optional — omit for anonymous/free tier)
```

Key obtained at https://jina.ai/reader — free signup, no credit card required.

---

## Rate Limits

| Tier | Reader (`r.jina.ai`) RPM | Search (`s.jina.ai`) RPM |
|------|--------------------------|--------------------------|
| No API key | **20 RPM** | Blocked |
| Free API key | **500 RPM** | 100 RPM |
| Paid API key | **500 RPM** | 100 RPM |
| Premium API key | **5,000 RPM** | 1,000 RPM |

Global IP cap: 10,000 requests per 60 seconds across all services.

---

## Endpoint

**Base URL:** `https://r.jina.ai/`

| Method | Pattern | Cost |
|--------|---------|------|
| GET | `https://r.jina.ai/<TARGET_URL>` | Tokens consumed |
| POST | `https://r.jina.ai/` + body `url=<TARGET_URL>` | Tokens consumed (for hash-based SPAs) |

**Scrape a page:**
```bash
# Anonymous (no key, 20 RPM)
curl "https://r.jina.ai/https://example.com"

# With API key (500 RPM)
curl "https://r.jina.ai/https://example.com" \
  -H "Authorization: Bearer API_KEY"

# JSON response
curl "https://r.jina.ai/https://example.com" \
  -H "Authorization: Bearer API_KEY" \
  -H "Accept: application/json"
```

---

## Key Request Headers

| Header | Values | Notes |
|--------|--------|-------|
| `Authorization` | `Bearer <key>` | Optional; unlocks higher RPM |
| `Accept` | `text/plain` (default), `application/json`, `text/event-stream` | Controls envelope |
| `X-Return-Format` | `markdown` (default), `html`, `text`, `screenshot` | Output format |
| `X-Engine` | `auto`, `browser`, `curl` | `browser` = headless Chrome for JS-heavy pages |
| `X-Remove-Selector` | CSS selector | Strip matching elements (e.g. banners) |
| `X-Target-Selector` | CSS selector | Return only matching element content |
| `X-Wait-For-Selector` | CSS selector | Wait for element before capture |
| `X-No-Cache` | `true` | Bypass 1-hour cache |
| `X-Max-Tokens` | integer ≥ 500 | Truncate output |
| `X-Proxy-Url` | proxy URL | Route through custom proxy (http/socks5) |
| `X-Set-Cookie` | cookie string | Forward cookies (disables cache) |

---

## Response Shape

### Default (plain text)
```
Title: <Page Title>
URL Source: <Final URL after redirects>

<Markdown content>
```

### JSON (`Accept: application/json`)
```json
{
  "code": 200,
  "status": 20000,
  "data": {
    "title": "Page Title",
    "description": "Meta description",
    "url": "https://example.com",
    "content": "# Markdown content...",
    "usage": {
      "tokens": 1234
    },
    "images": {},
    "links": {}
  }
}
```

Markdown content at `data.content`.

---

## Error Behavior

| HTTP Code | Meaning |
|-----------|---------|
| `200` | Success — **also returned when target page 404s** (see quirk below) |
| `400` | Bad request / invalid parameters |
| `401` | Invalid or missing API key |
| `429` | Rate limit exceeded |
| `5xx` | Server / processing failure |

**Known quirk:** When the target URL itself returns 404, Reader returns HTTP 200 with a `warning` field:
```json
{
  "code": 200,
  "status": 20000,
  "data": {
    "warning": "Target URL returned error 404: Not Found",
    "content": "Unknown.",
    "usage": { "tokens": 2 }
  }
}
```
Detect dead pages by checking `data.warning` or `data.content === "Unknown."` when using JSON mode.

---

## YouTube URL Behavior

- Endpoint: `https://r.jina.ai/https://www.youtube.com/watch?v=<VIDEO_ID>`
- **Returns:** title, description, view count, upload date, channel info — in Markdown
- **Does NOT return:** transcript, captions, comments
- Private/deleted videos → HTTP 403

---

## Performance

- ~2s average response time (cloud SaaS benchmark, spider.cloud Feb 2026)
- Cache TTL: 3,600s (1 hour); bypass with `X-No-Cache: true`
- Max timeout: 180s (via `X-Timeout` header)

---

## Key Differences vs Crawl4AI / Firecrawl

- **No infrastructure** — single GET request, no API key required for MVP
- Default response is **raw Markdown text** (not JSON envelope) — simplest possible integration
- **Free anonymous tier** (20 RPM) works without signup for early prototyping
- Target-404 returns HTTP 200 — must check `data.warning` in JSON mode to detect dead pages
