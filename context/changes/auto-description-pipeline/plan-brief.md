# Auto-description Pipeline — Plan Brief

> Full plan: `context/changes/auto-description-pipeline/plan.md`
> Research: `context/changes/auto-description-pipeline/research.md`
> Flow collision: `context/changes/auto-description-pipeline/scraping-flow-comparison.md`

## What & Why

Saved links currently land in the inbox raw — just a URL. This pipeline auto-generates a 1-2 sentence micro-description for each link so the user remembers what it was without re-opening it. It reproduces the cheap, proven data-acquisition flow from the bot-dancer talk, adapted to the codebase's Markdown-native constraint.

## Starting Point

The queue consumer (`src/worker.ts`) is a verified no-op that logs and acks. The DB already has `micro_description` and `processing_status` columns with RLS + Realtime enabled, and both capture paths (desktop + bot) already enqueue links on insert. The inbox island only subscribes to INSERT events and only renders a `pending` badge.

## Desired End State

A captured link appears as `pending`, transitions live through `processing` to `done` with a micro-description rendered beneath the URL — no reload. YouTube links are summarized from their transcript; pages Jina can't reach fall back to Wayback; links that exhaust all tiers show a `failed` badge and stay in the list. MVP runs at ~$0.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Scraping flow model | Reproduce Mrugalski's talk flow | Cheap, proven, MVP-ideal | Plan |
| Page cascade | Jina → Wayback → paid-stub | Both free tiers cover MVP; learn before paying | Plan |
| Paid proxy vendor | Deferred (stub returns null) | No scraping experience yet — dogfood to learn what Jina misses | Plan |
| YouTube | Separate RapidAPI transcript branch | Jina returns nav chrome, not transcript (live-tested) | Plan |
| HTML handling | Markdown-native, zero in-Worker parsing | Strictly better LLM input than regex-strip | Research |
| LLM | gpt-4o-mini, few-shot house-style prompt | Cheapest; examples give consistent style | Research + Plan |
| Style examples | Hardcoded (no per-user corpus yet) | No user history at MVP; per-user is future BYOK | Plan |
| Failed-link UX | Badge only | Queue `max_retries:3` already covers transients | Plan |
| Batch model | `max_batch_size:1`, per-link retry | I/O-bound; granular retry, simplest consumer | Research |

## Scope

**In scope:** queue consumer pipeline; Jina + Wayback + YouTube scraping; paid-proxy stub; gpt-4o-mini describe service; key plumbing (`LLM_API_KEY`, `RAPIDAPI_KEY`, `getLlmApiKey`); frontend UPDATE subscription + badges + description rendering.

**Out of scope:** paid proxy vendor; manual retry button; stale-`processing` cron; per-user style/BYOK; in-Worker HTML parsing; schema migrations; test runner setup.

## Architecture / Approach

Bottom-up: config/secrets → leaf services (`scrapeJina`, `scrapeWayback`, `scrapePaidProxy`, `scrapeYouTubeTranscript`, `describeContent` — each `(...) => Promise<string|null>`) → `scrapeContent` orchestrator (YouTube branch vs `??` cascade) → consumer (status `processing` → scrape → describe → write `done`/`failed` via service-role admin client) → frontend live update. Realtime carries the consumer's UPDATEs to the owning user via the existing SELECT RLS policy.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Config & key plumbing | env schema, secrets, `getLlmApiKey`, batch=1 config | `access:"public"` would dead-code-strip guards |
| 2. Scraping services | Jina/Wayback/YouTube/paid-stub + orchestrator | YouTube must branch before cascade |
| 3. LLM describe service | gpt-4o-mini few-shot micro-description | prompt style quality; token budget |
| 4. Queue consumer | full scrape→describe→write pipeline | ack/retry semantics; status-before-work |
| 5. Frontend live updates | UPDATE subscription, badges, description | merge-by-id (not prepend); auth-before-subscribe |

**Prerequisites:** OpenAI API key, RapidAPI YouTube-transcript key (free tier), local Supabase or remote test creds.
**Estimated effort:** ~2-3 sessions across 5 phases.

## Open Risks & Assumptions

- Jina free tier (~20rpm keyless / 500rpm keyed) is sufficient for MVP testing volume.
- RapidAPI transcript free tier covers dogfooding (~100-500/day depending on listing).
- Stale `processing` rows (consumer crash mid-work) are acceptable at MVP — no cleanup yet.
- No test runner — services are pure functions, manual scratch-invocation verifies them.

## Success Criteria (Summary)

- A normal link, a YouTube link, and a failing link each reach their correct terminal state live in the inbox without reload.
- Descriptions read in a consistent house style.
- Total MVP cost stays at ~$0.
