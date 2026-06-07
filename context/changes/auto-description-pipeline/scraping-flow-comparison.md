# Scraping & Transcript Flow — Talk vs. Repo Research

This document collides two sources on how to acquire article and video content for automatic summarization. The first is Mrugalski's conference talk (`references/bot-dancer.md`), a Polish walkthrough of how he automates his newsletter, including a concrete article-scraping cascade and a YouTube transcript flow. The second is our own S-02 research (`context/changes/auto-description-pipeline/research.md`), which proposes a 3-tier scraping architecture for the `auto-description-pipeline` change. The goal is to surface where the two agree, where they diverge, and which decisions that divergence forces us to make before implementation.

## The Talk's Flow (bot-dancer.md)

Mrugalski's content acquisition has two branches: articles and videos. After acquisition, both feed an LLM that summarizes in his personal note structure.

### Article scraping cascade

```
1. Simple free scraper
   → fetch the page, strip all HTML tags, dump the text into LLM context
   ↓ (page refuses scraping / blocks)
2. Paid proxy scraper
   → proxy servers rotating worldwide; "usually beats every wall"
   ↓ (even the paid proxy fails)
3. Web Archive
   → fetch the archived copy of the page from the web archive, parse it
```

His stated heuristic: "if you can't reach a page through the network, use the web archive — pull the archived copy and parse it." Note the ordering — the paid proxy comes BEFORE the archive (quality/success-first, not cost-first).

### The summarization style trick

He feeds OLD descriptions/notes as examples so the LLM matches his own structure: "I pull my old notes and say: summarize this the way I always write my notes — and I get back the same structure." This is also how he runs his earlier article classifier ("does this article fit bucket A or bucket B?") — prompt-by-example rather than prompt-by-rule.

### YouTube flow

```
1. Detect a video link
2. Call an external micro-API (bought on RapidHub / RapidAPI) to fetch the video's subtitles/captions
   - prefer: corrected English subtitles
   - then:   Polish subtitles
   - then:   auto-generated captions (~50% inaccurate, but "perfectly fine for summarization")
3. Summarize from the transcript
```

### Costs he cites (scraping/transcripts only)

- YouTube transcript package: **free** — a legacy plan giving 500 requests/day ("I don't watch that many videos, so it's fine").
- Paid proxy scraper: **≈ $2/month**, enough to summarize **~1000 articles/month**.

His takeaway: these are not large costs for the volume, and the same flow generalizes to anyone who wants to auto-summarize their own information sources.

## Our Repo's Proposed Flow (research.md)

The research proposes a 3-tier article cascade plus a YouTube branch, all normalized to Markdown before the LLM step.

### Article scraping cascade

```
1. Tier 1 — Jina Reader (PRIMARY)
   GET https://r.jina.ai/<target-url> → Markdown; ~80% coverage, zero config, free tier
   ↓ (empty content)
2. Tier 2 — Wayback Machine (free fallback)
   availability lookup → fetch snapshot → (Jina on the wayback URL → Markdown)
   ↓ (empty content)
3. Tier 3 — ScrapingBee / paid proxy (last, expensive)
   GET ...?return_page_markdown=true → Markdown
```

Stated rationale: "Wayback before paid proxy keeps cost near-zero at MVP scale." The order is explicitly **cost-first**, with a note to reorder to Jina → paid → Wayback if Wayback's real-world hit rate turns out to be low.

### YouTube branch

- RapidAPI transcript endpoint (`GET .../transcript?url=...` with `X-RapidAPI-Key`), returning `{ text, start, duration }[]`.
- URL detection (`youtube.com/watch` / `youtu.be/`) routes the link to this branch before the article cascade.
- Auto-generated captions accepted as sufficient (citing bot-dancer.md).

### LLM and summarization

- **gpt-4o-mini** recommended on cost/quality ratio ($0.21 / 1k calls), 7× cheaper than Haiku 4.5; single ops-key as `LLM_API_KEY`, abstracted behind `getLlmApiKey(userId)`.
- Prompt design for the 1-2 sentence micro-description is explicitly **deferred** ("Open Question 3 — not researched here, straightforward at planning"). The style-by-example idea is not covered.

### Markdown / no-HTML-parsing decision

- Every tier returns Markdown or plain text natively (`scrapeXxx(url): Promise<string | null>`). The consumer never receives or parses HTML.
- Wayback's raw HTML is handled by routing the wayback URL back through Jina Reader (Readability extraction + `X-Remove-Selector: #wm-ipp-base` to drop the archive toolbar), so `cheerio`/`jsdom`/regex stripping are all avoided. `HTMLRewriter` is documented as a fallback but not used.

## Head-to-Head Comparison

| Aspect | Talk (Mrugalski) | Repo Research | Notable difference |
|---|---|---|---|
| Free scraper | Own simple scraper: fetch + strip HTML tags into context | Jina Reader (`r.jina.ai`), Markdown via Readability | Same role (free primary); repo offloads to a managed service that also handles JS rendering, instead of a homemade tag-stripper |
| Paid proxy scraper | Paid rotating-proxy scraper, ≈$2/mo for ~1000 articles | ScrapingBee (~$49/mo) or cheaper alt (ZenRows ~$19, RapidAPI proxy); vendor deferred | Same concept; talk's vendor is ~10-25× cheaper than research's default pick — vendor choice still open |
| Archive fallback | Web Archive: fetch archived copy, parse it | Wayback Machine: availability API → snapshot → Jina re-extract | Same source; repo avoids raw-HTML parsing by re-feeding the snapshot through Jina |
| **Cascade ORDER** | free → **paid proxy** → archive (success/quality-first) | Jina → **Wayback** → paid (cost-first) | **Inverted middle/last tiers.** Talk treats the paid proxy as the reliable workhorse before archive; repo pushes paid to the very last to protect MVP cost |
| HTML handling | Regex/tag-strip the page into raw text | Markdown-native at every tier; zero in-Worker HTML parsing | Talk dumps stripped text; repo insists on clean Markdown and no `cheerio`/`jsdom`/regex |
| YouTube transcripts | RapidHub micro-API; EN-corrected → PL → auto-captions; ~50% auto is fine | RapidAPI transcript endpoint; auto-captions sufficient | Same vendor family and "auto is good enough" stance; repo doesn't yet encode the EN→PL→auto preference ladder |
| LLM / summarization | Unspecified model; summarize from text/transcript | gpt-4o-mini, REST from Worker; summarize from Markdown/transcript | Talk is model-agnostic; repo locks a specific cheap model |
| Style personalization | Feeds OLD notes as examples → output matches his structure | Prompt design deferred; style-by-example not covered | **Gap.** A concrete, proven prompt technique in the talk has no counterpart in the research yet |
| Costs | YouTube transcripts free (legacy 500/day); proxy ≈$2/mo ~1000 articles | gpt-4o-mini $0.21/1k calls; Jina free tier; paid proxy ~$19-49/mo if used | Both cheap; repo's paid tier is pricier but designed to fire rarely (last resort), so effective cost stays low |

## Where They Agree

- Three escalating tiers for articles: a free primary, a paid-proxy fallback, and a web-archive fallback.
- A web archive is the right last-ditch route when the live page is unreachable/blocked.
- YouTube is a separate branch handled by an external RapidAPI/RapidHub transcript micro-service.
- Auto-generated captions are accurate enough for summarization (no need to insist on human-corrected subtitles).
- The whole thing is cheap at this scale — costs are not a reason to avoid building it.
- Summaries should be produced by an LLM from the extracted text/transcript, not by templating.

## Where They Diverge

- **Cascade order: paid-proxy-before-archive (talk) vs archive-before-paid (research).**
  Why it matters: it directly changes our per-link cost and success profile. Cost-first (research) is cheapest but bets on Wayback having a usable, fresh snapshot; quality-first (talk) spends ~$2/mo to maximize live-content success. We must pick one for Tier 2/3 and wire the cascade accordingly.
- **HTML handling: regex tag-strip (talk) vs Markdown-native, no parsing (research).**
  Why it matters: the repo decision removes a whole class of in-Worker HTML-parsing code (no `cheerio`/`jsdom`/regex, no `HTMLRewriter` for MVP). Adopting the talk's strip approach would re-introduce that, so we should keep the Markdown-native rule and not be tempted by the simpler-sounding strip.
- **Style personalization: proven example-based prompt (talk) vs deferred prompt design (research).**
  Why it matters: micro-description quality is the user-visible payoff of S-02. The talk hands us a concrete, low-effort technique (feed prior descriptions as style examples). Leaving prompt design fully deferred risks a generic-sounding output; we should decide whether to seed the prompt with example descriptions now.
- **Paid proxy vendor/price: ~$2/mo proxy (talk) vs ScrapingBee ~$49/mo default (research).**
  Why it matters: the talk suggests a far cheaper proxy tier is achievable. If we keep paid as Tier 3 (rare), price matters little; if we move it to Tier 2 (frequent), vendor cost becomes material. Vendor choice is coupled to the order decision above.
- **Transcript language preference: explicit EN→PL→auto ladder (talk) vs unspecified (research).**
  Why it matters: our research only says "auto-captions are fine." Encoding a preference ladder (corrected EN, then PL, then auto) would improve transcript quality when better tracks exist, at near-zero extra cost — worth deciding whether the chosen RapidAPI listing even exposes track selection.

## Open Decisions This Surfaces

- **Tier order — cost-first vs quality-first.** Ship cost-first (Jina → Wayback → paid) per current research, or adopt the talk's quality-first (Jina → paid → Wayback)? Tie-breaker: real Wayback hit rate. Consider shipping cost-first behind a config flag so we can flip after a week of dogfooding (research Open Question 5).
- **Adopt the style-by-example prompt trick?** Decide whether the gpt-4o-mini prompt should include prior `micro_description` rows as style exemplars. If yes, where do exemplars come from on a cold start (no prior descriptions yet)? This closes research Open Question 3.
- **Paid-proxy vendor pick.** ScrapingBee (~$49), ZenRows (~$19), or a cheap RapidAPI/RapidHub proxy closer to the talk's ~$2/mo? The choice is coupled to whether paid sits at Tier 2 (frequent → price matters) or Tier 3 (rare → price negligible). Closes research Open Question 1.
- **RapidAPI YouTube listing + track preference.** Confirm the specific transcript listing, and whether to implement the EN→PL→auto preference ladder or accept whatever single track the API returns. Closes research Open Question 2.
- **Keep the Markdown-native / no-HTML-parsing rule.** Confirm we hold the line on Markdown at every tier (re-feeding Wayback through Jina) rather than the talk's regex-strip shortcut, even if a future cheaper proxy returns raw HTML (then revisit `HTMLRewriter`).
