# Auto-description Pipeline — Plan Brief

> Full plan: `context/changes/auto-description-pipeline/plan.md`
> Research: `context/changes/auto-description-pipeline/research.md`
> Flow collision: `context/changes/auto-description-pipeline/scraping-flow-comparison.md`

## What & Why

Saved links currently land in the inbox raw — just a URL. This pipeline auto-generates a 1-2 sentence micro-description for each link so the user remembers what it was without re-opening it. It reproduces the cheap, proven data-acquisition flow from the bot-dancer talk, adapted to the codebase's Markdown-native constraint.

## Starting Point

The queue consumer (`src/worker.ts`) is a verified no-op that logs and acks. The DB already has `micro_description` and `processing_status` columns with RLS + Realtime enabled, and both capture paths (desktop + bot) already enqueue links on insert. The inbox island only subscribes to INSERT events and only renders a `pending` badge.

## Desired End State

A captured link appears as `pending`, transitions live through `processing` to `done` with a micro-description rendered beneath the URL — no reload. YouTube links are detected and short-circuited to a "coming soon" placeholder (transcript tier deferred post-MVP); pages Firecrawl can't reach are marked unsupported (`failed`) and stay in the list (full Wayback/paid-proxy fallback deferred post-MVP). MVP runs at ~$0.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Scraping flow model | Reproduce Mrugalski's talk flow | Cheap, proven, MVP-ideal | Plan |
| Page scraping | Firecrawl only (MVP) | Single tier proves the flow cheaply; full 3-tier (Wayback + paid proxy) deferred post-MVP | Plan |
| Unsupported page | Mark `failed`, retain link | No fallback at MVP — a Firecrawl miss is a visible `failed` badge, never lost | Plan |
| YouTube | Detect + placeholder (transcript deferred) | Scrapers return nav chrome, not transcript (live-tested); transcript tier parked post-MVP | Plan |
| HTML handling | Markdown-native, zero in-Worker parsing | Strictly better LLM input than regex-strip | Research |
| LLM | gpt-4o-mini, few-shot house-style prompt | Cheapest; examples give consistent style | Research + Plan |
| Style examples | Hardcoded (no per-user corpus yet) | No user history at MVP; per-user is future BYOK | Plan |
| Failed-link UX | Badge only | Queue `max_retries:3` already covers transients | Plan |
| Batch model | `max_batch_size:1`, per-link retry | I/O-bound; granular retry, simplest consumer | Research |

## Scope

**In scope:** queue consumer pipeline; Firecrawl page scraping (single tier); YouTube detection + placeholder; gpt-4o-mini describe service; key plumbing (`LLM_API_KEY`, `FIRECRAWL_API_KEY`, `getLlmApiKey`); frontend UPDATE subscription + badges + description rendering.

**Out of scope:** full multi-tier scraping (Wayback archive + paid proxy — deferred post-MVP); YouTube transcript tier (detection-only at MVP); manual retry button; stale-`processing` cron; per-user style/BYOK; in-Worker HTML parsing; schema migrations; test runner setup.

## Architecture / Approach

Bottom-up: config/secrets → leaf services (`scrapeFirecrawl`, `isYouTubeUrl`, `describeContent` — each `(...) => Promise<string|null>` except the boolean detector) → thin `scrapeContent` orchestrator (single Firecrawl tier at MVP; seam for the future cascade) → consumer (detect YouTube → placeholder early-exit; else status `processing` → scrape → describe → write `done`/`failed` via service-role admin client) → frontend live update. Realtime carries the consumer's UPDATEs to the owning user via the existing SELECT RLS policy.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Config & key plumbing | env schema, secrets, `getLlmApiKey`, batch=1 config | `access:"public"` would dead-code-strip guards |
| 2. Scraping services | Firecrawl + YouTube detection + thin orchestrator | YouTube must branch before scrape; single tier at MVP |
| 3. LLM describe service | gpt-4o-mini few-shot micro-description | prompt style quality; token budget |
| 4. Queue consumer | full scrape→describe→write pipeline | ack/retry semantics; status-before-work |
| 5. Frontend live updates | UPDATE subscription, badges, description | merge-by-id (not prepend); auth-before-subscribe |

**Prerequisites:** OpenAI API key, Firecrawl API key (free plan), local Supabase or remote test creds.
**Estimated effort:** ~2-3 sessions across 5 phases.

## Open Risks & Assumptions

- Firecrawl free plan (1,000 pages/month, 10 RPM / 2 concurrent) is sufficient for MVP dogfooding volume.
- No fallback at MVP — pages Firecrawl can't scrape are simply marked `failed`; acceptable while dogfooding reveals what's actually missed before building the 3-tier flow.
- Stale `processing` rows (consumer crash mid-work) are acceptable at MVP — no cleanup yet.
- No test runner — services are pure functions, manual scratch-invocation verifies them.

## Success Criteria (Summary)

- A normal link, a YouTube link, and a failing link each reach their correct terminal state live in the inbox without reload.
- Descriptions read in a consistent house style.
- Total MVP cost stays at ~$0.
