# Crawl4AI — Developer Reference

**URL:** https://crawl4ai.com / https://docs.crawl4ai.com
**Type:** Open-source Python library + self-hosted Docker REST API (NO public cloud API as of 2026-06-08)

---

## Pricing

| Option | Cost | Notes |
|--------|------|-------|
| Python library (self-hosted) | Free | Apache 2.0 license |
| Docker REST API (self-hosted) | Free | Requires VPS/Cloud Run/Fly.io to expose publicly |
| Cloud API | Not available | Closed beta — apply at forms.gle/E9MyPaNXACnAMaqG7; no ETA |

Self-hosted TCO estimate at 100K pages/month: ~$385–585/month (compute + proxies + engineering overhead).

---

## Authentication

```
# Self-hosted (JWT disabled by default)
No headers required

# JWT mode (when enabled in config.yml)
Header: Authorization: Bearer <JWT_TOKEN>
# Obtain token: POST /token { "email": "...", "api_token": "sk_live_..." }
```

---

## Rate Limits

No per-client rate limit. Server-side global cap: **40 concurrent pages** (internal semaphore). No documented RPM ceiling.

---

## Endpoint (Self-Hosted Docker Only)

**Docker image:** `unclecode/crawl4ai:latest`

```bash
docker run -d -p 11235:11235 --name crawl4ai --shm-size=1g unclecode/crawl4ai:latest
```

**Base URL:** `http://localhost:11235` (or your deployed host)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/crawl` | Synchronous scrape (blocks until done) |
| POST | `/crawl/stream` | Streaming SSE |
| POST | `/crawl/job` | Async job submission |
| GET | `/job/{task_id}` | Poll async job result |
| POST | `/md` | Markdown with filtering |
| POST | `/screenshot` | PNG capture |
| GET | `/monitor/health` | Health check |

**Scrape a page (sync):**
```bash
curl -X POST "http://localhost:11235/crawl" \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example.com"]}'
```

---

## Response Shape

Always JSON — NOT raw Markdown text.

```json
{
  "success": true,
  "results": [
    {
      "url": "https://example.com",
      "success": true,
      "html": "<html>...</html>",
      "markdown": "# Title\n\nContent...",
      "extracted_content": {},
      "links": {},
      "media": {},
      "status_code": 200,
      "error_message": null
    }
  ]
}
```

Markdown at `results[0].markdown`. Also returns raw `html`, `links`, `media` in same envelope.

---

## Error Behavior

| HTTP Code | Meaning |
|-----------|---------|
| `200` | Success |
| `422` | Validation error (bad request body) |
| `500` | Server error / crawl failure |

On crawl failure: HTTP 200 with `results[0].success: false` and `error_message` populated.

---

## Cloudflare Worker Compatibility

| Path | Usable from CF Worker? |
|------|------------------------|
| Python library | **No** — requires Python runtime |
| Cloud API | **No** — closed beta, no public access |
| Self-hosted Docker | **Only if you deploy + expose it** |

If self-hosted and publicly exposed, a Worker can call it:
```typescript
const res = await fetch("https://your-server.com/crawl", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ urls: [targetUrl] }),
});
const { results } = await res.json();
const markdown = results[0].markdown;
```

**Verdict:** Not viable for a CF Worker at MVP. Requires persistent infra (VPS/container) which violates the ~$0 MVP budget.

---

## Performance

- ~5s average response time (spider.cloud benchmark, Feb 2026 — slowest among tested tools)
- Playwright browser startup per page is the main latency driver
- Designed for batch/async workloads, not low-latency single-URL requests

---

## Maintenance

- **GitHub:** github.com/unclecode/crawl4ai — ~68,000 stars
- **Maintainer:** individual `@unclecode` (not a company)
- **Latest release:** v0.8.9 on 2026-06-04 (very active)
- **License:** Apache 2.0

---

## Key Differences vs Jina Reader / Firecrawl

- **No public cloud API** — self-hosting required adds infra overhead and cost
- Response is **JSON envelope** (not raw Markdown text like Jina Reader)
- Slowest in benchmark (~5s vs Jina ~2s)
- Best fit: Python backend with complex extraction needs, batch crawling, or when full HTML + links + media metadata are needed alongside Markdown
- Wrong tool for: Cloudflare Worker with ~$0 budget and simple "URL → Markdown" need
