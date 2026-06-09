# Web Scraper Comparison: Jina Reader vs Firecrawl vs Crawl4AI

**Context:** Auto-description pipeline for a Cloudflare Worker. Need: URL → Markdown via `fetch()`. Constraint: ~$0 MVP budget, no Python, no persistent infra, Cloudflare Worker runtime.

---

## Side-by-Side Comparison

| Dimension | Jina Reader | Firecrawl | Crawl4AI |
|-----------|-------------|-----------|----------|
| **Type** | Cloud SaaS | Cloud SaaS + FOSS | Python lib + self-hosted Docker |
| **Public cloud API** | Yes | Yes | No (closed beta) |
| **CF Worker compatible** | Yes — raw GET | Yes — raw POST or SDK | Only if self-hosted + exposed |
| **Implementation to first request** | 1 line — `fetch("https://r.jina.ai/<url>")` | 3 lines — POST + parse `data.data.markdown` | Requires Docker infra or Python |
| **Free tier volume** | Unlimited tokens, 500 RPM w/ key (10M token budget) | 1,000 pages/month, 10 RPM | Free self-hosted (infra cost) |
| **Free tier cost** | $0, no card | $0, no card | $0 + VPS/container cost |
| **Rate limit (free)** | 20 RPM (no key) / 500 RPM (free key) | 10 RPM | No documented limit (self-hosted) |
| **Auth required** | No (anonymous 20 RPM works for MVP) | Yes (fc- key) | No (JWT optional) |
| **Response format** | Raw Markdown text (default) | JSON → `data.data.markdown` | JSON → `results[0].markdown` |
| **Avg response time** | ~2s | ~3s | ~5s |
| **YouTube handling** | Title + description only (no transcript) | Audio extraction (5 credits), Markdown of page | Self-hosted + full HTML |
| **Paywall handling** | No bypass; proxy header available | Enhanced proxy option (+4 credits) | No built-in bypass |
| **Maintenance** | Jina AI (company), active | YC-backed company, active | Individual @unclecode, very active |
| **License** | Proprietary SaaS | AGPL-3.0 (self-host) / SaaS | Apache 2.0 |

---

## Implementation Speed

### Jina Reader — fastest (1 line)

```typescript
const markdown = await fetch(`https://r.jina.ai/${url}`).then(r => r.text());
```

No key, no body, no JSON parsing. Works in a CF Worker today.

### Firecrawl — 3 lines, still fast

```typescript
const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
  method: "POST",
  headers: { "Authorization": `Bearer ${env.FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ url, formats: ["markdown"] }),
});
const markdown = (await res.json()).data.markdown;
```

Requires API key in `.dev.vars` and `wrangler secret put FIRECRAWL_API_KEY`.

### Crawl4AI — not viable at MVP

Requires: Docker container deployed and publicly exposed → VPS + DNS + maintenance. Cloud API closed beta with no ETA.

---

## Cost at MVP Scale

Estimate: ~100 links/day = ~3,000/month.

| Tool | 3,000 pages/month | Notes |
|------|-------------------|-------|
| **Jina Reader (free key)** | $0 | 10M token budget >> 3K pages |
| **Firecrawl (free tier)** | Exceeds free limit (cap = 1,000/month) | Need Hobby ($16/mo) for 5,000 credits |
| **Firecrawl (Hobby)** | $16/month | Covers ~5,000 pages |
| **Crawl4AI (self-hosted)** | ~$15–30/month infra | Fly.io/VPS + ops overhead |

---

## Recommendation

**Firecrawl is MVP Tier 1 — the single page scraper (plan locked 2026-06-08).** The MVP scrape path is one tier: Firecrawl succeeds → Markdown; Firecrawl misses → page marked `failed` (no fallback). Reasons Firecrawl over Jina Reader:

1. **Predictable free plan** — fixed 1,000 pages/month with explicit limits, vs Jina's token-budget model that's harder to reason about at the cost boundary; solo dogfooding volume sits well under 1,000/month.
2. **Official Cloudflare Worker support** — documented quickstart; raw POST `fetch()` returns clean JSON (`data.data.markdown`), reliable envelope.
3. **Better upgrade path baked in** — enhanced proxy rotation + YouTube audio extraction available when the deferred tiers ship, no second vendor to onboard.

Tradeoff accepted: Firecrawl needs an `fc-` key (`.dev.vars` + `wrangler secret put`) and caps at 1,000/month, where Jina's keyless anonymous tier has zero setup and higher free volume. At MVP single-user dogfooding the cap is a non-issue, and the key plumbing is shared with the rest of the pipeline.

**Jina Reader → deferred to the post-MVP Wayback tier**, not dropped. When the full multi-tier flow ships (roadmap §Parked), Jina is the keyless sub-call that fetches archive.org snapshots (`GET r.jina.ai/<snapshot>` + `X-Remove-Selector: #wm-ipp-base` to strip the Wayback banner) — it doesn't consume Firecrawl credits and supports the selector-removal header Firecrawl doesn't expose the same way.

**Crawl4AI: not applicable.** No public cloud API (closed beta), wrong runtime (Python — a CF Worker can't run it), highest latency (~5s), and self-hosting adds VPS + ops cost that violates the ~$0 MVP budget. Revisit only if the project ever migrates to a Python/Node server backend.

---

## One Quirk to Handle in Code (deferred Wayback/Jina tier)

> Not an MVP concern — Firecrawl Tier 1 surfaces 404/empty directly. Keep this for when the Jina-based Wayback tier ships.

Jina returns HTTP 200 even when the target page 404s. When using JSON mode (`Accept: application/json`), check:

```typescript
if (data.data.warning?.includes("404") || data.data.content === "Unknown.") {
  return null; // treat as definitive miss
}
```

Or in plain-text mode, check if body is `"Unknown.\n"` (2 tokens).

---

## References

- `doc-jina-reader.md` — full Jina Reader API reference
- `doc-firecrawl.md` — full Firecrawl API reference
- `doc-crawl4ai.md` — full Crawl4AI reference
- `plan.md` — Phase 2 scraping services design (Firecrawl as MVP Tier 1, single tier)
- `scraping-flow-comparison.md` — talk-vs-research cascade design collision
