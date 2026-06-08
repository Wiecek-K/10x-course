# TranscriptAPI.com — Developer Reference

**URL:** https://transcriptapi.com/
**Type:** Direct API (NOT via RapidAPI — separate key/account)

---

## Pricing

| Plan | Price | Credits/mo | Rate Limit | Card required |
|------|-------|------------|------------|---------------|
| Free | $0 | 100 (expire 30 days) | — | No |
| Monthly | $5/mo | 1,000 + topups at $2.50/1K | 200 RPM | Yes |
| Annual | $54/yr ($4.50/mo) | 1,000 + topups at $1.50/1K | 300 RPM | Yes |

1 credit = 1 successful request across all endpoints.

---

## Authentication

```
Header: Authorization: Bearer API_KEY
```

---

## Endpoint

**Base URL:** `https://transcriptapi.com/api/v2/youtube`

| Endpoint | Method | Cost |
|----------|--------|------|
| `/transcript` | GET | 1 credit |
| `/search` | GET | 1 credit/page |
| `/channel/videos` | GET | 1 credit/page |
| `/channel/latest` | GET | Free |

**Get transcript:**
```bash
curl "https://transcriptapi.com/api/v2/youtube/transcript?video_url=dQw4w9WgXcQ&format=json" \
  -H "Authorization: Bearer API_KEY"
```

Query params:
- `video_url` — bare 11-char video ID or full URL (param name is `video_url`)
- `format=json`

---

## Response Shape (200)

```json
{
  "title": "string",
  "duration": "string",
  "segments": [
    {
      "start": 0.0,
      "text": "Hello world."
    }
  ]
}
```

Transcript path: `response.segments[]` — fields: `start` (number), `text` (string).
No `duration` per segment (only video-level `duration` at root).

---

## Error Behavior

- No captions / unavailable: returns empty `segments` array (inferred — not explicitly documented)
- Rate limit: HTTP 429 (body not specified)
- Active subscription required to use topup credits

---

## Performance

- 49ms median response time
- 500K+ transcripts processed daily

---

## MCP Support

```
claude mcp add --transport http transcript-api https://transcriptapi.com/mcp
```

Compatible with Claude Code, Cursor, VS Code, Windsurf.

---

## Key Differences vs RapidAPI Providers

- **Not on RapidAPI** — separate account, different key, no `X-RapidAPI-Host` header
- Auth via `Authorization: Bearer` instead of `X-RapidAPI-Key` + `X-RapidAPI-Host`
- Response shape: `segments[]{start, text}` (same as solid-api was, but solid-api is dead)
- Free tier: 100 credits (same count as Supadata Basic, but credits expire after 30 days)
- Rate limit on paid: 200–300 RPM (Supadata Basic: 1000 req/hour)
