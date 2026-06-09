# RapidAPI YouTube Transcript — Owner Research Brief

> **Status:** 🚧 BLOCKER for Phase 2 `scrapeYouTubeTranscript` (`src/lib/services/youtube.ts`).
> Phases 1, 3, 4, 5 and the rest of Phase 2 proceed without this; the YouTube tier ships as a `null` stub until this doc is filled in.
> **You (owner) complete this personally**, then hand it back so the function gets implemented against a real, confirmed contract.

## Why this is blocked

The plan can't specify the request/response shape because RapidAPI hosts **many** different YouTube-transcript listings, each with its own host, path, params, and JSON shape. Picking one is a judgment call (pricing, free-tier limits, reliability, response quality) that needs hands-on evaluation — not something to guess in the plan.

## What to deliver back

Fill in every section below. When all `TODO` fields are replaced with real values, the blocker clears.

### 1. Chosen listing

- **Listing name (as shown on RapidAPI):** `TODO`
- **RapidAPI listing URL:** `TODO`
- **Why this one** (1–2 lines: free-tier limit, price/req, captions language coverage, reliability impression): `TODO`

### 2. Auth + endpoint

- **`X-RapidAPI-Host` value** (required header — gateway 403s without it): `TODO`
- **Endpoint method + path** (e.g. `GET /transcript`): `TODO`
- **How the video is passed** (query param? full URL or just the 11-char video id? param name): `TODO`
  - If it needs the bare video id, note it — `youtube.ts` must extract the id from both `youtube.com/watch?v=` and `youtu.be/` forms.
- **Any other required params** (lang, country, format): `TODO`

### 3. Free-tier limits

- **Requests/day or /month on the free plan:** `TODO`
- **Rate limit (req/sec or /min):** `TODO`
- **Does it require a credit card to start free tier?** `TODO`

### 4. Real sample response

Paste **one actual JSON response** from a real call (use the RapidAPI "Test Endpoint" console or `curl`). This is the most important deliverable — the implementation joins the segment array based on its exact shape.

```json
TODO — paste real response here
```

- **Path to the segment array** (e.g. `data.transcript[]`, or top-level array): `TODO`
- **Field holding each segment's text** (e.g. `text`, `snippet`): `TODO`
- **What the response looks like when the video has NO captions** (empty array? 404? error object?) — needed to map the definitive-`null` case correctly: `TODO`

### 5. Error behavior (for the throw-vs-null taxonomy)

The plan's error rule: `null` = definitive no-content (retrying won't help); **throw** = transient (queue retries).

- **No-captions / unavailable video → which HTTP status / body?** (this maps to `null`): `TODO`
- **Rate-limit / server error → which status?** (this maps to **throw**, status 429 / 5xx): `TODO`

### 6. The key itself

- Put the actual `RAPIDAPI_KEY` value into `.dev.vars` (never commit it; never use `###` as a placeholder — wrangler reads `#` as a comment).
- For production: `wrangler secret put RAPIDAPI_KEY`.
- Do **not** paste the real key into this doc (it's committed).

## Quick how-to (if unfamiliar with RapidAPI)

1. rapidapi.com → search "YouTube transcript".
2. Compare 2–3 listings on free-tier limits + recent reviews/uptime.
3. "Subscribe to Test" → free/Basic plan.
4. Open the endpoint → "Code Snippets" shows the exact host, path, headers (copy the `X-RapidAPI-Host`).
5. Run "Test Endpoint" with a known captioned video (e.g. a popular talk) → copy the JSON into §4.
6. Also test a video with captions disabled → record what §4/§5 "no captions" looks like.

## When done

Hand this filled doc back. Implementation step: replace the `youtube.ts` stub with the real call against this contract, keeping `isYouTubeUrl` and the error taxonomy already specced in the plan.
