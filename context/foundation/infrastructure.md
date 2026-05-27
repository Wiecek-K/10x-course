---
project: tabzero
researched_at: 2026-05-27
recommended_platform: Cloudflare Workers + Pages
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6
  runtime: Cloudflare Workers (V8 isolates)
  database: Supabase (PostgreSQL + Auth + Realtime)
  adapter: "@astrojs/cloudflare"
  package_manager: bun
---

## Recommendation

**Deploy on Cloudflare Workers + Pages.**

The tech stack was specifically built for Cloudflare: `@astrojs/cloudflare` adapter, `cloudflare:workers` env access, `astro:env/server` schema, and Cloudflare Builds CI are all pre-wired. Switching platforms would require a non-trivial adapter migration, env-var access rewrite, and new CI setup — real work for a 3-week solo MVP. Cloudflare scores Pass on all five agent-friendly criteria, Cloudflare Queues are available on the free plan for background job processing, and both the MCP server and `llms.txt` docs index are GA. The key CPU-limit concern (scraping + AI in a Worker) is architecturally resolved by delegating heavy processing to external scraping APIs — the Worker becomes a pure HTTP orchestrator (I/O-bound, no CPU pressure).

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent docs | Stable deploy API | MCP | **Total** |
|---|---|---|---|---|---|---|
| **Cloudflare Workers + Pages** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | **5 / 5** |
| **Vercel** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | **5 / 5** |
| **Netlify** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | **4.5 / 5** |
| **Fly.io** | ✅ Pass | ⚠️ Partial | ⚠️ Partial | ✅ Pass | ❌ Fail | **3 / 5** |
| **Railway** | ✅ Pass | ⚠️ Partial | ⚠️ Partial | ✅ Pass | ❌ Fail | **3 / 5** |
| **Render** | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial | ❌ Fail | **1.5 / 5** |

### Shortlisted Platforms

#### 1. Cloudflare Workers + Pages (Recommended)

First-class Astro 6 support via `@astrojs/cloudflare` (GA). `wrangler` CLI covers deploy, rollback, and log tailing. Docs published as `llms.txt` at `developers.cloudflare.com/workers/llms.txt`. Multiple MCP servers: `cloudflare/mcp-server-cloudflare` on GitHub and `observability.mcp.cloudflare.com/mcp` for runtime observability. Cloudflare Queues (GA) available on the free plan — 10k ops/day included, $0.40/M ops above that. Cloudflare Builds CI already configured in `tech-stack.md` with auto-deploy-on-merge. Zero migration cost: no adapter swap, no env-var rewrite, no new CI setup.

#### 2. Vercel

Scores 5/5 on agent-friendly criteria. Official `@astrojs/vercel` adapter (GA), `llms-full.txt` at `vercel.com/docs/llms-full.txt`, Vercel MCP at `mcp.vercel.com` (GA), Vercel Queues and Workflows (both GA) for background processing. Free Hobby tier covers 10k–100k requests/month at zero cost. Gap vs Cloudflare: requires adapter swap from `@astrojs/cloudflare` to `@astrojs/vercel`, rewrite of all `cloudflare:workers` env access, loss of Cloudflare-specific bindings, and a known Astro 6 esbuild parse error issue on Vercel SSR. Vercel's own docs recommend Node.js runtime over Edge runtime, meaning the Workers-runtime fidelity the current stack relies on is not replicated.

#### 3. Netlify

Strong second alternative to Vercel. "Astro 6 just works on Netlify" confirmed in March 2026 changelog. Official Netlify MCP server (`netlify/netlify-mcp`, GA). `llms.txt` at `docs.netlify.com/llms.txt`. Async Workloads primitive (GA) for multi-step background pipelines — more ergonomic than raw queue consumers. Credit-based free tier: 300 credits/month; 100k SSR requests ≈ 20–80 credits, well within the free tier. Risk: free tier hard-pauses the site on credit exhaustion (no graceful degradation). Middleware runs on Deno (Edge Functions) — same runtime restriction as Cloudflare for middleware code.

## Anti-Bias Cross-Check: Cloudflare Workers + Pages

### Devil's Advocate — Weaknesses

1. **CPU time limit:** Workers Free gives 10ms CPU/request; Workers Paid gives 30s. Any CPU-intensive code running directly in a Worker (e.g. in-process HTML parsing, synchronous AI inference) hits this hard. Applies to Queue consumer Workers too.
2. **Supabase connection pool exhaustion:** V8 isolates reset TCP connections between invocations. At >50 concurrent Workers, Supabase can run out of connections without Supavisor/pgBouncer. Invisible at MVP scale, painful at growth.
3. **Cloudflare Queues free tier:** 10k ops/day ≈ ~3300 link-processing jobs/day. Fine for MVP; upgrade to Workers Paid ($5/month) when this limit approaches.
4. **Vendor lock-in is real:** `cloudflare:workers` imports, Durable Objects, Queues, and `astro:env/server` CF-specific patterns make future platform migration meaningfully more expensive than a simple adapter swap.
5. **Cloudflare Builds ≠ GitHub Actions ecosystem:** no composite actions, no access to GitHub Secrets directly. Harder to add e2e tests or Slack deploy notifications without bridging to an external CI.

### Pre-mortem — How This Could Fail

The team ships tabzero on Cloudflare Workers. Three months in, users report that links from heavily JavaScript-rendered pages and paywalled articles never receive descriptions. Investigating the Queue consumer logs reveals that the first-tier scraper (a simple in-Worker HTML fetch and strip) times out on these pages — hitting the CPU limit for parsing complex DOM structures. The developer assumed the 30-second limit applied, not realising the free plan caps CPU at 10ms. The fix requires upgrading to Workers Paid ($5/month) AND refactoring the scraping pipeline to delegate heavy processing to external APIs instead of running it in-Worker — a change that would have been the right architecture from day one but now has to be retrofitted under user pressure.

### Unknown Unknowns

1. **CPU time ≠ wall-clock time.** A Worker can "live" 30 seconds waiting on I/O but burn CPU only for parsing/computation. 10ms CPU (free plan) is consumed instantly by complex HTML parsing or synchronous JSON transforms on large payloads. The mitigation: delegate all heavy work to external APIs — the Worker becomes a pure HTTP orchestrator with near-zero CPU consumption.
2. **`Astro.locals.runtime.env` removed in Astro 6.** Must use `import { env } from 'cloudflare:workers'` instead. Code copied from pre-v6 tutorials or the starter README will silently break if this isn't updated.
3. **Cloudflare Builds vs GitHub Actions:** Cloudflare Builds auto-deploys from the connected Git branch but has no native support for GitHub Actions secrets or composite actions. If CI needs to grow (add Playwright tests, deploy notifications), a hybrid setup (GitHub Actions triggers `wrangler deploy`) may be needed.
4. **Supabase Realtime + Workers edge latency.** Supabase Realtime runs from fixed regions (US East, EU West). Workers edge nodes can be geographically far from the Supabase instance — browser → Supabase Realtime WebSocket is fine, but Worker → Supabase DB round-trip may be higher than expected depending on the Workers routing.
5. **`bun` version pinning in Cloudflare Builds.** Cloudflare Builds ships Bun but the version may differ from local. Pin the Bun version in `wrangler.toml` or via a `.tool-versions` / `package.json` `engines` field to prevent silent CI breakage.

## Operational Story

- **Preview deploys:** Cloudflare Pages creates a preview URL for every push to a non-production branch. Previews are publicly accessible by default — add Cloudflare Access protection if links contain sensitive data. Fork PRs from external contributors do not get preview deploys unless the Pages project is configured to allow them.
- **Secrets:** Environment variables and tokens are stored in the Cloudflare dashboard under Workers & Pages → Settings → Environment Variables, or set via `wrangler secret put <NAME>`. Secrets are scoped per environment (preview / production). `SUPABASE_URL` and `SUPABASE_KEY` must be set in both. Rotation: `wrangler secret put <NAME>` overwrites in place; the next deploy picks up the new value.
- **Rollback:** `wrangler rollback` reverts the Worker to the previous deployment. For Pages, the dashboard "Rollback" button or `wrangler pages deployment rollback <DEPLOYMENT_ID>` redeploys a prior build in under 30 seconds. Database migrations do not roll back automatically — always pair a Supabase migration with a feature flag if the schema change is irreversible.
- **Approval:** An agent may perform: `wrangler deploy`, `wrangler tail` (log reading), `wrangler secret list`. A human must approve: rotating primary Supabase credentials, running destructive Supabase migrations, changing custom domain routing, and upgrading the Workers plan tier.
- **Logs:** `wrangler tail` streams live request logs and exceptions to the terminal in real time. Cloudflare observability MCP (`observability.mcp.cloudflare.com/mcp`) exposes structured log queries as agent tools. Workers Logs (GA) can be exported via OpenTelemetry to Axiom, Grafana Cloud, or Honeycomb for persistent log storage (default in-dashboard retention: 3 days).

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Workers free CPU limit (10ms) hit by in-Worker scraping code | Devil's advocate | M | H | Delegate all scraping to external APIs (Jina Reader, ScrapingBee, Wayback Machine) — Worker becomes HTTP orchestrator; CPU consumption near zero |
| Supabase connection pool exhaustion at scale | Devil's advocate | L (MVP) | M | Enable Supabase Supavisor connection pooling before launch; monitor `pg_stat_activity` |
| Cloudflare Queues free-tier limit (10k ops/day) reached | Devil's advocate | L (MVP) | L | Upgrade to Workers Paid ($5/month) at ~2000+ link-saves/day; monitor via Cloudflare dashboard |
| Vendor lock-in increases future migration cost | Devil's advocate | H | M | Acceptable trade-off for 3-week MVP; isolate CF-specific code in `src/lib/` adapters rather than spreading `cloudflare:workers` imports across all files |
| Astro 6 breaking change: `Astro.locals.runtime.env` removed | Unknown unknowns | H | M | Use `import { env } from 'cloudflare:workers'` everywhere; already handled in `src/lib/supabase.ts` via `astro:env/server` |
| `bun` version mismatch between local dev and Cloudflare Builds | Unknown unknowns | M | L | Pin Bun version in `wrangler.toml` build configuration |
| Scraping pipeline fails silently on paywalled / JS-heavy pages | Pre-mortem | H | M | Implement tiered scraping: Jina Reader → paid proxy API → Wayback Machine fallback (mirrors bot-dancer.md flow); save link without description on all-tier failure |
| Cloudflare Builds CI insufficient for growing pipeline | Unknown unknowns | L | L | Hybrid: keep Cloudflare Builds for deploy, add GitHub Actions for test/lint/e2e if needed |

## Getting Started

1. **Verify Astro 6 + wrangler compatibility:** `bun x wrangler --version` — ensure wrangler ≥ 3.x. The `@astrojs/cloudflare` adapter and Vite plugin are already wired in `astro.config.mjs`.

2. **Set secrets for production:**
   ```
   wrangler secret put SUPABASE_URL
   wrangler secret put SUPABASE_KEY
   ```
   Repeat for the `preview` environment if needed.

3. **Deploy to production:**
   ```
   bun run build
   wrangler deploy
   ```

4. **Connect Cloudflare Builds CI:** In the Cloudflare dashboard → Workers & Pages → your project → Settings → Builds & Deployments, connect the GitHub repo and set the production branch to `main`. Build command: `bun run build`. Output directory: `dist`.

5. **Add Cloudflare Queue for background processing:** Create the queue and bind it to the Worker:
   ```
   wrangler queues create tabzero-link-processing
   ```
   Then add to `wrangler.toml`:
   ```toml
   [[queues.producers]]
   queue = "tabzero-link-processing"
   binding = "LINK_QUEUE"

   [[queues.consumers]]
   queue = "tabzero-link-processing"
   max_batch_size = 10
   max_batch_timeout = 30
   ```

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup beyond Cloudflare Builds
- Production-scale architecture (multi-region, HA, DR)
- Scraping service infrastructure (external SaaS APIs recommended for MVP — Jina Reader, ScrapingBee, Wayback Machine)
