# YouTube Interim Metadata Description — Implementation Plan

## Overview

Replace the static YouTube placeholder in the queue consumer with a richer micro-description built
from URL metadata: **video title + author channel name**, fetched via YouTube's keyless **oEmbed**
endpoint. No Firecrawl, no LLM. Best-effort: any oEmbed failure falls back to the existing static
placeholder so links are never lost (FR-005). Interim step toward full YouTube transcripts (parked).

## Current State Analysis

- The queue consumer (`src/worker.ts:44-51`) detects `isYouTubeUrl(url)` and writes a fixed
  `micro_description = "YouTube video — transcript coming soon."` with `processing_status = "done"`,
  short-circuiting before the scrape+LLM pipeline. This is the **only seam** this change touches.
- `isYouTubeUrl()` (`src/lib/services/youtube.ts:1-13`) matches `youtube.com/watch`, `/shorts/`,
  and `youtu.be`; rejects `music.youtube.com`. **Unchanged by this plan** — its test
  (`youtube.test.ts:28-30`) stays green.
- Vendor services follow a null-vs-throw taxonomy (`firecrawl.ts`): `null` = definitive miss,
  `throw` = transient → `msg.retry()`. **This change deliberately departs from it** (see Approach).
- Test pattern: colocated `*.test.ts`, `vi.stubGlobal("fetch")` to simulate HTTP responses
  (`firecrawl.test.ts:16-25`). No `astro:env/server` mock needed here — oEmbed is keyless.
- `micro_description` is `text` nullable (`database.types.ts`); written via
  `admin.from("links").update({...})`.

## Desired End State

For any link whose URL passes `isYouTubeUrl`, the consumer fetches oEmbed metadata and writes
`"▶ {title} — {channel} · transcript coming soon"` with `processing_status = "done"`. If oEmbed
yields nothing usable (private/deleted video, embedding disabled, network blip, malformed response),
the consumer writes the unchanged static placeholder with `done`. The link row always reaches a
terminal `done` state in a single DB write; no retries, no `failed` for YouTube.

### Key Discoveries:

- oEmbed (`https://www.youtube.com/oembed?url=<watchUrl>&format=json`) returns `title` and
  `author_name` (the channel) directly — OG `<meta>` tags do not expose the channel cleanly, which
  is why oEmbed is the chosen source.
- oEmbed reliably accepts canonical `youtube.com/watch?v=<id>` URLs; `/shorts/` and `youtu.be` forms
  are best normalized to that canonical shape before the call.
- Best-effort (no retry) matches today's YouTube branch, which never retries.

## What We're NOT Doing

- NOT touching `isYouTubeUrl` or its tests.
- NOT handling `music.youtube.com` (stays `false`; parked item updated to reuse this helper later).
- NOT fetching transcripts or calling any LLM/Firecrawl.
- NOT adding an intermediate `scraping`/`describing` status for the YouTube branch (single write).
- NOT adding a worker.ts integration test harness (consumer has none today).
- NOT adding a new env var / secret (oEmbed is keyless).

## Implementation Approach

A small pure-ish helper `fetchYouTubeMetadata(url)` does: extract video id → build canonical watch
URL → call oEmbed → parse `{ title, channel }`. It returns `null` on **any** failure (no `throw`).
This is a deliberate departure from the `firecrawl.ts` null-vs-throw taxonomy: the user chose
best-effort (Q1), so the helper never asks the queue to retry — the consumer just falls back to the
static placeholder. The consumer's YouTube branch becomes: fetch → format string (or fallback) →
single `done` write → `ack()`.

## Critical Implementation Details

- **URL normalization** is the load-bearing detail. Extract the 11-char video id from all three
  matched forms (`youtu.be/<id>`, `youtube.com/watch?v=<id>`, `youtube.com/shorts/<id>`) and call
  oEmbed with `https://www.youtube.com/watch?v=<id>`. Passing a raw `/shorts/` or `youtu.be` URL to
  oEmbed is not guaranteed to resolve; the canonical form is. This same normalization is what lets
  the parked `music.youtube.com` task reuse the helper later.
- **Best-effort means the helper swallows errors** — wrap the `fetch` in try/catch and return `null`
  on network errors, non-2xx, or missing/empty `title`/`author_name`. It must NOT throw (a throw
  would propagate to the consumer's outer try/catch and trigger `msg.retry()`, which contradicts Q1).

## Phase 1: oEmbed metadata helper

### Overview

Add `fetchYouTubeMetadata` to `src/lib/services/youtube.ts` alongside `isYouTubeUrl`, with colocated
unit tests. TDD-able: pure input→output with mockable `fetch`.

### Changes Required:

#### 1. Metadata helper

**File**: `src/lib/services/youtube.ts`

**Intent**: Given a YouTube URL, return `{ title, channel }` from oEmbed, or `null` on any failure
(best-effort). Reuses the same module that already owns `isYouTubeUrl`.

**Contract**: `export async function fetchYouTubeMetadata(url: string): Promise<{ title: string; channel: string } | null>`.
Internally: extract video id (return `null` if none) → `GET https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D<id>&format=json` → on `!response.ok` return `null` → parse JSON → if `title` or `author_name` missing/empty return `null` → return `{ title, channel: author_name }`. Wrap fetch in try/catch returning `null` (never throws). A video-id extraction helper may be factored out but is not required to be exported.

#### 2. Helper unit tests

**File**: `src/lib/services/youtube.test.ts` (extend existing file)

**Intent**: Cover the success path, the failure→null paths, and id-normalization, mirroring
`firecrawl.test.ts`'s `vi.stubGlobal("fetch")` style.

**Contract**: New `describe("fetchYouTubeMetadata")` block. Cases: (a) 200 + valid oEmbed body →
`{ title, channel }`; (b) `/shorts/`, `youtu.be`, and `/watch` inputs all call `fetch` with the
canonical `watch?v=<id>` oEmbed URL (assert via `fetch` mock args); (c) non-2xx (404) → `null`;
(d) network error (rejected fetch) → `null` (NOT a throw — the key divergence from firecrawl);
(e) malformed/empty JSON → `null`; (f) missing `title` or missing `author_name` → `null`;
(g) URL with no extractable id → `null` (no fetch call).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `bun run test`
- Type checking + lint pass: `bun run lint`

#### Manual Verification:

- (none — pure helper, fully covered by unit tests)

**Implementation Note**: After Phase 1 automated verification passes, proceed to Phase 2.

---

## Phase 2: Wire metadata into the consumer YouTube branch

### Overview

Replace the static-string write in the consumer's YouTube branch with a metadata-driven description
plus fallback. Single terminal `done` write.

### Changes Required:

#### 1. Consumer YouTube branch

**File**: `src/worker.ts` (the `if (isYouTubeUrl(url))` block, lines 44-51)

**Intent**: Call `fetchYouTubeMetadata(url)`; build `"▶ {title} — {channel} · transcript coming soon"`
when present, else fall back to the existing static placeholder; write once with `done` and `ack()`.

**Contract**: Branch becomes:

```ts
if (isYouTubeUrl(url)) {
  const meta = await fetchYouTubeMetadata(url);
  const micro_description = meta
    ? `▶ ${meta.title} — ${meta.channel} · transcript coming soon`
    : "YouTube video — transcript coming soon.";
  await admin.from("links").update({ micro_description, processing_status: "done" }).eq("id", msg.body.linkId);
  msg.ack();
  return;
}
```

Import `fetchYouTubeMetadata` alongside the existing `isYouTubeUrl` import (`src/worker.ts:5`).

### Success Criteria:

#### Automated Verification:

- Type checking + lint pass: `bun run lint`
- Build succeeds: `bun run build`
- Existing unit suite still green: `bun run test`

#### Manual Verification:

- Send a public YouTube `/watch` link via the Telegram bot → inbox shows `▶ <title> — <channel> · transcript coming soon` within seconds.
- Send a `youtu.be` short link and a `/shorts/` link → both resolve to the same metadata format.
- Send a private/deleted YouTube link → inbox shows the static `"YouTube video — transcript coming soon."` fallback, status `done` (not `failed`).

**Implementation Note**: After Phase 2 automated verification passes, pause for manual confirmation
(bot → inbox) before considering the change complete.

---

## Testing Strategy

### Unit Tests:

- `fetchYouTubeMetadata`: success parse, id-normalization across all three URL forms, every
  failure→null path (non-2xx, network error, malformed JSON, missing fields, no id).

### Manual Testing Steps:

1. Public `/watch` link via bot → title+channel description.
2. `youtu.be` + `/shorts/` links → same format.
3. Private/deleted link → static fallback, `done`.

## References

- Similar vendor helper + test pattern: `src/lib/services/firecrawl.ts:11`,
  `src/lib/services/firecrawl.test.ts:16`
- Scrape orchestrator (taxonomy this change departs from): `src/lib/services/scrape.ts`
- Roadmap entry: `context/foundation/roadmap.md` → S-02a

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: oEmbed metadata helper

#### Automated

- [x] 1.1 Unit tests pass: `bun run test`
- [x] 1.2 Type checking + lint pass: `bun run lint`

### Phase 2: Wire metadata into the consumer YouTube branch

#### Automated

- [x] 2.1 Type checking + lint pass: `bun run lint`
- [x] 2.2 Build succeeds: `bun run build`
- [x] 2.3 Existing unit suite still green: `bun run test`

#### Manual

- [x] 2.4 Public `/watch` link via bot → inbox shows `▶ <title> — <channel> · transcript coming soon`
- [x] 2.5 `youtu.be` + `/shorts/` links → same metadata format
- [x] 2.6 Private/deleted link → static fallback placeholder, status `done` (not `failed`)
