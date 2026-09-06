# tabzero

Personal link library with zero-friction capture and AI-powered micro-descriptions. Save a link in two clicks or one message; find it weeks later by asking in plain language — no category system to design upfront.

Live: https://tabzero.ajmag.workers.dev

---

## What it does

- **Capture** — send a URL to the Telegram bot; it confirms in under 2 seconds
- **Auto-describe** — the background pipeline scrapes the page via Firecrawl and generates a micro-description using an LLM; YouTube links get title + channel from oEmbed instead
- **Inbox management** — review links, track visits, and consciously close each one in one of three modes: _keep in library_, _consume and close_, or _discard_
- **Library** — closed-but-kept links stay searchable; natural-language search is next on the roadmap

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Astro 6 SSR + React 19 islands |
| Styles | Tailwind v4 + shadcn/ui (new-york) |
| Database / Auth | Supabase (PostgreSQL + RLS + SSR sessions) |
| Runtime / Deploy | Cloudflare Workers via `@astrojs/cloudflare` |
| Background jobs | Cloudflare Queues (`tabzero-link-processing`) |
| Package manager | Bun |
| CI | Cloudflare Builds (auto-deploy on merge to `main`) |

---

## Local development

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- [Docker](https://docs.docker.com/get-docker/) (for local Supabase)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (`bun add -g wrangler`)

### Setup

```bash
# 1. Install dependencies
bun install

# 2. Environment — two separate files (wrangler reads .dev.vars, not .env)
cp .env.example .env          # for Node-based tooling (Vitest, type-gen)
cp .env.example .dev.vars     # for wrangler dev

# 3. Fill in both files: SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY,
#    TELEGRAM_BOT_TOKEN, TELEGRAM_SECRET_TOKEN, ANTHROPIC_API_KEY, FIRECRAWL_API_KEY

# 4. Start local Supabase stack
bunx supabase start
# Studio at http://localhost:54323

# 5. Apply migrations
bunx supabase db reset

# 6. Start the dev server (Cloudflare workerd runtime)
bun run dev
```

### Commands

```bash
bun run dev          # dev server (workerd runtime via wrangler)
bun run build        # production build (SSR via @astrojs/cloudflare)
bun run preview      # preview production build

bun run test         # Vitest unit suite (Node environment)
bun run test:watch   # Vitest in watch mode

bun run lint         # ESLint with type-checked rules
bun run lint:fix     # auto-fix lint issues
bun run format       # Prettier (printWidth: 120; .md excluded)
bun run format:check # CI gate — run before opening a PR
```

> **Before opening a PR:** run `bun run format`. CI fails on `format:check`.
> Three layers keep formatting clean: the post-edit hook formats files as they are edited,
> the pre-commit hook (Husky + lint-staged) formats staged files, and `bun run format`
> catches anything outside those paths.

### Telegram bot (local)

The bot webhook endpoint is `POST /api/bot/webhook`. For local testing, expose it with
[ngrok](https://ngrok.com) or similar, then register the URL with Telegram:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-tunnel>/api/bot/webhook&secret_token=<TELEGRAM_SECRET_TOKEN>
```

---

## Architecture

### Rendering

Full SSR (`output: "server"` in `astro.config.mjs`). React is used only for interactive
islands — inbox list, closure dialog, edit dialog, link dashboard. Static content and layout
stay in Astro.

### Auth

Cookie-based sessions via `@supabase/ssr`. `src/middleware.ts` resolves the user on every
request and attaches them to `context.locals.user`. Protected routes redirect unauthenticated
users to `/auth/signin`. The Telegram bot writes links using a Supabase admin client
(service-role key) and resolves `telegram_id → user_id` from the pairing-codes table.

### Link processing pipeline

```
POST /api/links
  └─ enqueue(linkId) → Cloudflare Queue
       └─ Consumer Worker
            ├─ isYouTubeUrl? → fetchYouTubeMetadata (oEmbed, no LLM)
            └─ else          → scrapeFirecrawl → describeLlm (gpt-4o-mini)
                               → UPDATE links SET micro_description, processing_status
```

Processing is fully async — capture confirms immediately, description arrives within ~30 s.
Links that cannot be scraped are marked `failed` and shown with a visual indicator; they are
never lost.

### Link lifecycle (4 states)

| State | Meaning |
|---|---|
| `inbox` | Newly saved; user has not acted on it |
| `library` | Consumed and kept — stays searchable |
| `consumed_closed` | Consumed and dismissed — permanently deleted |
| `discarded` | Dismissed without reading — permanently deleted |

Visiting a link does not change its state — only a deliberate closure action does.

### Data isolation

Every `links` row is owned by `user_id`. Row-level security policies on the `links` table
enforce that no user can read or modify another user's data — even if API guards fail.

---

## Project structure

```
src/
  components/          React islands + Astro components
    hooks/             useLinkActions, useLinks
    ui/                shadcn/ui primitives
  lib/
    services/          firecrawl.ts, describe.ts, youtube.ts, scrape.ts
    queue.ts           producer helper
    queue-consumer.ts  consumer handler (state machine)
    supabase.ts        SSR client
    supabase-admin.ts  service-role client (bot only)
  pages/
    api/links/         GET + POST /api/links, PATCH + DELETE /api/links/[id]
    api/bot/webhook.ts Telegram webhook
    api/auth/          signin, signup, signout
  types.ts             shared entity types + literal unions

supabase/migrations/   timestamped SQL migrations with RLS policies
context/               living project documentation (see below)
```

### `context/` — living documentation

All planning documents live here and are the source of truth for decisions, not trailing notes.

```
context/foundation/    PRD, roadmap, API conventions, tech stack, infrastructure,
                       lessons learned, test plan, E2E testing guide
context/changes/       active change folders (each has plan.md + change.md)
context/archive/       completed changes (one folder per shipped slice)
context/ideas/         parked feature ideas
```

---

## Development workflow (10x flow)

This project follows the **10x slice workflow** driven by Claude Code skills:

1. **Shape** — `/ 10x-shape` — discovery conversation → `context/foundation/shape-notes.md`
2. **PRD** — `/10x-prd` — generates `context/foundation/prd.md` from shape notes
3. **Roadmap** — `/10x-roadmap` — ordered vertical slices in `context/foundation/roadmap.md`
4. **Plan** — `/10x-plan <change-id>` — creates `context/changes/<id>/plan.md` with phased tasks
5. **Implement** — `/10x-implement <change-id>` — executes the plan phase by phase with atomic commits
6. **Archive** — `/10x-archive <change-id>` — moves the folder to `context/archive/`, stamps roadmap

Each change folder contains `change.md` (identity, status) and `plan.md` (phases, progress).
The roadmap is the single source of truth for what is done, in progress, and proposed next.

### Current roadmap status

| ID | Slice | Status |
|---|---|---|
| F-01 | Domain data foundation (schema + RLS) | done |
| F-02 | Background processing skeleton (CF Queue) | done |
| S-01 | Telegram bot capture → inbox | done |
| S-02 | Auto-description pipeline (Firecrawl + LLM) | done |
| S-02a | YouTube metadata description (oEmbed) | done |
| S-04 | Closure flow + per-link manual edit | done |
| S-03 | Natural-language search | proposed |
| S-06 | Category proposal + routing | proposed |
| S-05 | Browser extension capture | proposed |

---

## Testing

Unit tests are colocated with source files (`src/**/*.test.ts`) and run in Node environment
via Vitest. Test coverage focuses on the six documented risk scenarios:

1. Queue deadlock / message not acked
2. Telegram webhook forgery (HMAC validation)
3. Queueing parity (bot and REST API both enqueue)
4. Transient scraping errors (retry vs. permanent failure)
5. LLM call failure (graceful degradation to `failed` status)
6. RLS enforcement (user cannot read another user's links)

E2E testing guide: `context/foundation/e2e-testing.md`.

---

## Deployment

```bash
# Build first — wrangler deploy alone deploys stale dist/
bun run build
bunx wrangler deploy
```

Set these Cloudflare secrets before deploying:

```bash
bunx wrangler secret put SUPABASE_URL
bunx wrangler secret put SUPABASE_KEY
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
bunx wrangler secret put TELEGRAM_BOT_TOKEN
bunx wrangler secret put TELEGRAM_SECRET_TOKEN
bunx wrangler secret put ANTHROPIC_API_KEY
bunx wrangler secret put FIRECRAWL_API_KEY
```

Infrastructure details and risk register: `context/foundation/infrastructure.md`.

---

## API conventions

Full contract (status codes, response shapes, RLS→404 rationale): `context/foundation/api-conventions.md`.

Summary:
- Auth check first — `401` if no session
- `201` create, `200` read/update, `204` delete
- Single resource not found or not yours → `404` (never `403`)
- Errors: `{ error: "<code>" }`
