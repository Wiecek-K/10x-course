# YouTube Interim Metadata Description — Plan Brief

> Full plan: `context/changes/youtube-metadata-description/plan.md`

## What & Why

Today every YouTube link gets the same static placeholder (`"YouTube video — transcript coming
soon."`) because real transcripts need a paid provider that isn't chosen yet (parked). As an interim
win, show the **video title + channel name** pulled from YouTube's keyless oEmbed endpoint — no
Firecrawl, no LLM — while keeping the "transcript coming soon" signal.

## Starting Point

The queue consumer (`src/worker.ts:44-51`) detects `isYouTubeUrl(url)` and writes the fixed
placeholder with `processing_status = "done"`, short-circuiting the scrape+LLM pipeline. That branch
is the only seam this change touches.

## Desired End State

A YouTube link resolves to `"▶ {title} — {channel} · transcript coming soon"` in the inbox within
seconds. If oEmbed yields nothing usable (private/deleted video, network blip, malformed response),
the link falls back to the unchanged static placeholder — still `done`, never `failed`, never lost.

## Key Decisions Made

| Decision                  | Choice                                              | Why (1 sentence)                                                              | Source |
| ------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- | ------ |
| Metadata source           | YouTube oEmbed (not OG `<meta>`)                    | oEmbed returns `author_name` (channel) directly; OG doesn't expose it cleanly | Plan   |
| Failure handling          | Best-effort → static placeholder fallback           | Simplest, zero regression, link never lost (FR-005); matches today's branch   | Plan   |
| Description format        | `▶ {title} — {channel} · transcript coming soon`    | Keeps the transcript-in-progress signal; ▶ visually marks video in inbox      | Plan   |
| processing_status flow    | Single write → `done` (no intermediate state)       | oEmbed is sub-second; an intermediate status is needless DB churn             | Plan   |
| URL normalization         | Extract video id → canonical `watch?v=<id>`         | oEmbed reliably accepts canonical form; also enables future music reuse       | Plan   |
| Tests                     | Unit-test the helper (mirror `firecrawl.test.ts`)   | Matches existing colocated vendor-test pattern; consumer has no harness today | Plan   |
| Handoff                   | `/10x-tdd` for Phase 1, then `/10x-implement` Ph. 2 | Helper is pure/test-first; consumer wiring isn't TDD-shaped                    | Plan   |

## Scope

**In scope:** oEmbed helper `fetchYouTubeMetadata` + unit tests; rewire the consumer YouTube branch;
update the parked `music.youtube.com` roadmap note (OG → oEmbed reuse).

**Out of scope:** `isYouTubeUrl` and its tests; `music.youtube.com` handling; transcripts; any
LLM/Firecrawl call; intermediate processing status; worker.ts integration test harness; new env vars.

## Architecture / Approach

`fetchYouTubeMetadata(url)` = extract video id → build canonical watch URL → `GET oembed?...&format=json`
→ parse `{ title, channel: author_name }`, returning `null` on any failure (it never throws — a
deliberate departure from the `firecrawl.ts` null-vs-throw taxonomy, because best-effort means no
retry). The consumer's YouTube branch calls it, formats the string or falls back, and does one
`done` write.

## Phases at a Glance

| Phase                          | What it delivers                                  | Key risk                                                   |
| ------------------------------ | ------------------------------------------------- | ---------------------------------------------------------- |
| 1. oEmbed metadata helper      | `fetchYouTubeMetadata` + unit tests               | URL-id extraction must cover watch/shorts/youtu.be forms   |
| 2. Wire into consumer          | YouTube branch uses metadata + fallback           | Helper must not throw, or it would trigger an unwanted retry |

**Prerequisites:** S-02 done (it is); on branch `youtube-metadata-description`.
**Estimated effort:** ~1 short session, 2 phases.

## Open Risks & Assumptions

- Assumes oEmbed returns `author_name` for the channel on public videos (true for standard videos).
- ▶ renders as a plain char in micro_description; acceptable in the current inbox text rendering.
- oEmbed has no documented rate limit for low MVP volume; best-effort fallback absorbs any throttling.

## Success Criteria (Summary)

- Public YouTube links show `▶ title — channel · transcript coming soon` in the inbox.
- `youtu.be` and `/shorts/` links resolve to the same format via canonical normalization.
- Unusable/private videos fall back to the static placeholder, `done`, never lost.
