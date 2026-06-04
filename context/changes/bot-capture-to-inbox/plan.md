# Bot capture to inbox (S-01) — Implementation Plan

## Overview

Add a Telegram capture channel to tabzero: a user links their Telegram account to their Supabase account once (via a deep-link pairing token), then saving a link is "paste URL into the bot → see it in the inbox". S-01 stores the URL only; the auto-description arrives later in S-02. This is the first user-facing slice and the second half of the wedge-proof chain (F-01 → **S-01** → S-02).

## Current State Analysis

F-01 is done and is the substrate:

- **`links`** table (`supabase/migrations/20260529120000_create_links.sql`) — `id`, `user_id` (FK `auth.users`, `ON DELETE CASCADE`), `url`, nullable `micro_description`, `in_library` (default `false` = inbox), `processing_status` (default `'pending'`, CHECK enum), `last_visited`, timestamps. RLS enabled with granular per-operation policies scoped `auth.uid() = user_id`. Reusable `set_updated_at()` trigger function exists.
- **`POST /api/links`** (`src/pages/api/links/index.ts`) — authenticated via `context.locals.user` (cookie session); inserts `{ user_id, url }`, returns `201`. **`GET /api/links`** returns `{ links }` ordered by `created_at desc`, optional `in_library` filter.
- **Auth** — `src/lib/supabase.ts` `createClient(headers, cookies)` builds a cookie-based SSR client from `SUPABASE_URL`/`SUPABASE_KEY` (`astro:env/server`), returns `null` if unset. `src/middleware.ts` resolves `context.locals.user` on every request; `PROTECTED_ROUTES = ["/dashboard"]`.
- **Types** — `src/types.ts` narrows `processing_status` to a `ProcessingStatus` union over the generated `Database` row type. `src/db/database.types.ts` is the generated schema.
- **UI** — `src/pages/dashboard.astro` is a placeholder (shows email + sign-out). `Topbar.astro` exists. React islands live under `src/components/`, hooks under `src/components/hooks/`. shadcn/ui in `src/components/ui/` (`button.tsx` present).
- **Config** — `astro.config.mjs` declares only `SUPABASE_URL`/`SUPABASE_KEY` in the env schema. `wrangler.jsonc` **does** bind the `LINK_QUEUE` queue and points `main` at `src/worker.ts` (F-02 is merged on this branch). The custom worker delegates `fetch` to Astro's `@astrojs/cloudflare/handler`, so new API routes (`/api/pairing`, `/api/bot/webhook`) are served normally; it also defines a no-op queue consumer that logs + acks. `src/lib/queue.ts` exports `enqueueLink(linkId, userId)`, and `POST /api/links` already calls it after insert — so S-01's webhook must enqueue too (Phase 3), or bot-captured links would silently skip the S-02 processing pipeline that desktop links enter.

### Key Discoveries

- The bot webhook is **server-to-server**: it has no Supabase cookie session, so `auth.uid()` is `NULL` and the `links`/`telegram_links` RLS policies can never pass through the normal client. The insert must run with a **service-role client** that bypasses RLS, with `user_id` resolved from the pairing mapping — never from anything the Telegram payload claims. (Conscious tech debt → `SECURITY DEFINER` RPC post-MVP; roadmap S-01 + Linear TAB-13.)
- **Lesson `lessons.md` — phase-gate ordering**: a phase that changes `wrangler.jsonc "main"` must create the entrypoint in the same phase. Not triggered here — we add env vars via `astro:env`, not Worker bindings, so no `worker-configuration.d.ts` change.
- **Lesson `lessons.md` — 404 for non-owned**: targets single-resource-by-id endpoints. None of the new endpoints fetch a row by id, so it does not apply; the rule still informs that RLS is a safety net, not an API contract — hence explicit auth on every new endpoint.
- **Telegram delivers `telegram_id` for free** in every webhook update (`message.from.id`); the only hard problem is _binding_ it to a `user_id`, which pairing solves once.
- **CLAUDE.md — strong typing**: narrow constrained columns in `src/types.ts`, cast at the query boundary. Applies to the new tables.

## Desired End State

A paired user sends any message containing a URL to the bot and within ~2s gets "Saved ✅"; the link appears (auto-refreshing) in the web inbox under their account with `processing_status = 'pending'`. An unpaired sender is told how to pair and nothing is stored. Pairing is a one-time deep-link click from a top-right account menu, with a clear regenerate path if the token expires. Verified by a manual E2E checklist (no test runner in repo yet).

### Verify it

- Click "Connect Telegram" → deep-link opens the bot → `/start` pairs → menu shows "Connected ✅".
- Send a URL from Telegram → "Saved ✅" → row in `links` for the right `user_id`, `pending` → appears in inbox without manual refresh.
- Forged webhook POST (wrong/no secret) → rejected. Unpaired `telegram_id` → instructed, no row written. Expired token → bot says so, UI offers a fresh link.

## What We're NOT Doing

- No auto-description / scraping / LLM / queue (that is S-02). Links land `pending` and stay there.
- No duplicate detection — the same URL sent twice creates two links (deliberate; settings-based dedup is post-MVP, roadmap Parked).
- No multi-URL capture, no user-controlled description-on-capture (post-MVP, roadmap Parked).
- No closure flow / manual edit / visit tracking (S-04). The inbox is read-only.
- No `SECURITY DEFINER` RPC — service-role is the chosen MVP path (TAB-13).
- No automated test runner — manual E2E now; Vitest units backfilled after S-02 (roadmap Parked).
- No WhatsApp/other platform, no native mobile app.

## Implementation Approach

Build bottom-up so each phase is independently verifiable: data + config substrate → the full pairing loop end-to-end (web mints a token, bot consumes it) → URL capture on the bot → web UI (account-menu pairing + auto-refreshing inbox) → external registration + manual E2E. The webhook is one endpoint grown across phases 2–3: phase 2 implements only the `/start` (pairing) branch; phase 3 adds the plain-message (capture) branch and unpaired handling.

## Critical Implementation Details

- **Trust boundary in the webhook**: the inserted `user_id` comes _only_ from the `telegram_links` lookup keyed by `message.from.id`. Never read a user id from the message body. The service-role client is confined to a single helper module imported only by the bot endpoint.
- **Webhook response codes vs Telegram retries**: Telegram retries on non-2xx. Return `401` for a failed secret check (we _want_ forged requests rejected) and `200` for every handled/unhandled-but-authentic update (including "expired token", "unpaired", "no URL") so Telegram does not retry a delivered message. Bot replies are sent as a separate Bot API call, not in the webhook response body.
- **`telegram_id` width**: store as `bigint` — Telegram user ids exceed 32-bit range.
- **Confirmation latency (NFR ≤2s)**: the capture path is a single mapping lookup + single insert, then one `sendMessage`. Keep it to those round-trips; do not block the reply on anything else.

---

## Phase 1: Data model + config foundation

### Overview

Create the two pairing tables with RLS, regenerate DB types, add the domain types, and wire the new secrets + the service-role client helper. No behavior yet — this is the substrate phases 2–4 build on.

### Changes Required

#### 1. Migration — pairing tables

**File**: `supabase/migrations/20260603120000_create_telegram_pairing.sql`

**Intent**: Persist the ephemeral pairing tokens and the permanent Telegram↔user mapping, both RLS-protected per user.

**Contract**:

- `public.pairing_codes`: `id uuid PK default gen_random_uuid()`, `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `token text NOT NULL UNIQUE`, `expires_at timestamptz NOT NULL`, `used_at timestamptz`, `created_at timestamptz NOT NULL default now()`. Index on `token`.
- `public.telegram_links`: `telegram_id bigint PRIMARY KEY`, `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `created_at timestamptz NOT NULL default now()`. Index on `user_id`.
- RLS enabled on both. Policies: `pairing_codes` — `SELECT` + `INSERT` for `authenticated` where `auth.uid() = user_id` (web app mints/reads its own); no update/delete policy (token is burned by the service-role webhook, which bypasses RLS). `telegram_links` — `SELECT` for `authenticated` where `auth.uid() = user_id` (web shows "connected" state); no insert/update/delete policy (writes happen only via the service-role webhook). Follow the granular per-operation, per-role pattern from `20260529120000_create_links.sql`.

#### 2. Regenerate DB types

**File**: `src/db/database.types.ts`

**Intent**: Reflect the two new tables in the generated Supabase types so the app is type-safe.

**Contract**: Regenerate via the project's existing `supabase gen types` flow. `Database["public"]["Tables"]` gains `pairing_codes` and `telegram_links`.

#### 3. Domain types

**File**: `src/types.ts`

**Intent**: Expose narrowed entity types for the new tables alongside `Link`.

**Contract**: `export type PairingCode = Database["public"]["Tables"]["pairing_codes"]["Row"]` and `export type TelegramLink = Database["public"]["Tables"]["telegram_links"]["Row"]` (plus `Insert` aliases as needed). No constrained-enum columns here, so no union narrowing required.

#### 4. Env schema + local vars

**Files**: `astro.config.mjs`, `.env.example`, `.dev.vars` (local, gitignored)

**Intent**: Declare the new server-only secrets and the bot username used to build deep-links.

**Contract**: Add to `astro.config.mjs` `env.schema` (all `context: "server"`): `TELEGRAM_BOT_TOKEN` (secret), `TELEGRAM_WEBHOOK_SECRET` (secret), `SUPABASE_SERVICE_ROLE_KEY` (secret), `TELEGRAM_BOT_USERNAME` (access `"public"` is fine — it's the @handle). Mirror placeholders into `.env.example`; real values into `.dev.vars`. Keep them `optional: true` to match the existing null-checked pattern.

#### 5. Service-role client helper

**File**: `src/lib/supabase-admin.ts`

**Intent**: A single, isolated admin client that bypasses RLS, imported only by the bot endpoint.

**Contract**: `createAdminClient(): SupabaseClient<Database> | null` built from `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (`astro:env/server`), with no cookie/session wiring and auth persistence disabled. Returns `null` if either var is missing (same null-check contract as `createClient`). A file-top comment must flag it as the RLS-bypassing client and reference TAB-13.

### Success Criteria

#### Automated Verification

- Migration applies cleanly against a local stack: `bunx supabase db reset`
- Lint passes: `bun run lint`
- Build passes (type-checks the new types + env usage): `bun run build`

#### Manual Verification

- `pairing_codes` and `telegram_links` exist in Studio with RLS enabled and the expected policies.
- A direct `select` on either table as an anonymous/other user returns no rows (RLS holds).

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual checks before Phase 2.

---

## Phase 2: Pairing end-to-end (token API + webhook `/start`)

### Overview

Close the full pairing loop: the web app mints a one-time token and returns a deep-link; the bot webhook consumes `/start <token>`, writes the permanent mapping, and burns the token. After this phase, "pairing works end-to-end" is a single provable checkpoint.

### Changes Required

#### 1. Pairing token endpoint

**File**: `src/pages/api/pairing.ts`

**Intent**: For the logged-in web user, create a fresh single-use pairing token and hand back a Telegram deep-link.

**Contract**: `POST`, `prerender = false`. Reject with `401` if `!context.locals.user`. Generate a cryptographically random token (`crypto.getRandomValues`, ≥32 bytes) encoded as **base64url without padding** (or lowercase hex) — the token MUST match Telegram's `/start` deep-link constraint of `[A-Za-z0-9_-]` and ≤64 chars (32 bytes → 43-char base64url). Do **not** use standard base64 (`+`, `/`, `=`) or any char outside that set, or Telegram silently drops the payload and `/start` arrives token-less. Insert into `pairing_codes` `{ user_id, token, expires_at = now + 15 min }` via the authenticated `createClient` (RLS `WITH CHECK auth.uid() = user_id`). Do not invalidate prior unused codes here — the authenticated client has no UPDATE/DELETE policy on `pairing_codes` (Phase 1), so a delete/expire would silently affect 0 rows. Stale codes self-expire via the 15-min TTL and are rejected by the webhook's `used_at IS NULL AND expires_at > now()` check; multiple short-lived codes coexisting is acceptable. Bulk cleanup of expired/used rows is deferred to TAB-14. Respond `201` with `{ deepLink: "https://t.me/<TELEGRAM_BOT_USERNAME>?start=<token>", expiresAt }`. On a missing client/secret → `500 { error: "server_error" }`, matching the existing endpoints' shape.

#### 2. Bot webhook — secret check + pairing branch

**File**: `src/pages/api/bot/webhook.ts`

**Intent**: Authenticate Telegram, and on `/start <token>` bind the sender's `telegram_id` to the token's `user_id`.

**Contract**: `POST`, `prerender = false`. First verify the `X-Telegram-Bot-Api-Secret-Token` header equals `TELEGRAM_WEBHOOK_SECRET` via a constant-time compare; mismatch → `401`. Parse the update JSON; read `message.from.id` (the `telegram_id`) and `message.text`. If `text` matches `/start <token>`: using the **admin client**, look up `pairing_codes` by `token` requiring `used_at IS NULL AND expires_at > now()`; if valid, `upsert` `telegram_links (telegram_id, user_id)` on conflict `telegram_id` updating `user_id` (re-pair allowed), set that code's `used_at = now()`, and reply "Connected ✅". If invalid/expired, reply with an "expired — generate a new link in the app" message. Always return `200` for authentic updates. (Plain non-`/start` messages: no-op `200` in this phase — capture lands in Phase 3.)

#### 3. Bot reply helper

**File**: `src/lib/telegram.ts`

**Intent**: One place that talks to the Telegram Bot API.

**Contract**: `sendMessage(chatId: number, text: string): Promise<void>` doing `POST https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage` via `fetch`. Also a `constantTimeEqual(a, b)` util (or colocate in the webhook). Reads `TELEGRAM_BOT_TOKEN` from `astro:env/server`.

### Success Criteria

#### Automated Verification

- Lint passes: `bun run lint`
- Build passes: `bun run build`

#### Manual Verification (via `wrangler dev` + `curl`)

- `POST /api/pairing` while signed in returns a well-formed deep-link; a `pairing_codes` row appears with `expires_at ≈ now+15m`, `used_at = null`.
- `POST /api/pairing` unauthenticated → `401`.
- `curl` simulating a Telegram `/start <token>` update **with** the correct secret header → `telegram_links` row written, `used_at` stamped, bot reply attempted ("Connected ✅" — observable in `wrangler` logs / against a real bot).
- Same request with wrong/absent secret header → `401`, no DB write.
- `/start <expired-or-used-token>` → no mapping written, "expired" reply.

**Implementation Note**: Pause for human confirmation of the manual checks before Phase 3.

---

## Phase 3: Capture URL (webhook plain-message branch)

### Overview

Add the capture half to the webhook: a paired sender's plain message gets its first URL extracted and saved as a `pending` link; an unpaired sender is instructed; messages without a URL are nudged.

### Changes Required

#### 1. Webhook — capture + unpaired branches

**File**: `src/pages/api/bot/webhook.ts`

**Intent**: Turn an incoming URL from a known sender into a stored link, and guide everyone else.

**Contract**: For an authentic update whose `text` is **not** a `/start` command: resolve `message.from.id → user_id` via `telegram_links` (admin client). If **no mapping** → reply with the pairing instruction ("I don't know you yet — open the app, Connect Telegram, then come back"); store nothing. If mapped: extract the **first** `https?://` URL from `text` (ignore surrounding words); if none → reply "Send me a link to save"; if found → insert into `links` `{ user_id, url }` via the admin client (`.select().single()` to get the new `id`; `processing_status` defaults to `'pending'`), then enqueue it with `enqueueLink(data.id, user_id)` from `@/lib/queue` so bot links enter the same S-02 pipeline as desktop links. The enqueue is best-effort/non-fatal — mirror `POST /api/links`: wrap in `try/catch`, log on failure, still reply "Saved ✅". On insert error → reply "Try again". Return `200` throughout. `user_id` must come only from the mapping lookup.

#### 2. URL extraction util

**File**: `src/lib/url.ts` (or colocated)

**Intent**: Pull the first valid http(s) URL out of free text.

**Contract**: `extractFirstUrl(text: string): string | null`. Matches the first `http(s)://…` token; returns it trimmed, or `null`. Keep it small and predictable; share-sheet text like "look at this: https://… nice" yields the URL.

### Success Criteria

#### Automated Verification

- Lint passes: `bun run lint`
- Build passes: `bun run build`

#### Manual Verification (via `wrangler dev` + `curl`)

- Simulated message "check this https://example.com/article great" from a **paired** `telegram_id` → a `links` row for the correct `user_id`, `processing_status = 'pending'`; "Saved ✅" reply.
- Message from an **unpaired** `telegram_id` → pairing-instruction reply; **no** `links` row.
- Message with no URL from a paired sender → "send a link" reply; no row.
- The link is attributed to the mapped user even though the payload contains a different `from` identity field (trust-boundary check).
- The saved link emits a queue message — observable in `wrangler dev` logs as `[queue] consumed describe v1 for link <id>` — so bot links enter the S-02 pipeline.

**Implementation Note**: Pause for human confirmation before Phase 4.

---

## Phase 4: Web UI — account menu pairing + inbox island

### Overview

Give the dashboard a top-right account menu (email, sign-out, Connect Telegram with expiry/regenerate and connected-state) and a React inbox island that auto-refreshes so links sent from the phone appear without a manual refresh.

### Changes Required

#### 1. Connected-state for SSR

**File**: `src/pages/dashboard.astro`

**Intent**: Tell the UI whether the user is already paired and seed the inbox.

**Contract**: On render, query `telegram_links` for `context.locals.user.id` (authenticated client) to compute a `connected` boolean, and pass it to the account menu island. Also fetch the user's links server-side (the same query as `GET /api/links`) and pass them to the inbox island as `initialLinks` along with `userId`, `supabaseUrl`, and `supabaseAnonKey` (read from `astro:env/server` here and handed down as props — the anon key is public and safe to expose to the island; never import `astro:env/server` from the island itself). Replace the placeholder body with the `Topbar`/account-menu + the inbox island.

#### 2. Account menu island (with pairing)

**File**: `src/components/AccountMenu.tsx` (+ a hook under `src/components/hooks/` if state grows)

**Intent**: A top-right popover showing email + sign-out + Telegram pairing, satisfying the expired-token recovery requirement.

**Contract**: A React island opened from a top-right button. Shows the user email and a sign-out action (reuse the existing `POST /api/auth/signout` form). Telegram section: if `connected`, show "Connected ✅"; else a "Connect Telegram" button that calls `POST /api/pairing`, renders the returned deep-link as a clickable link, and shows a countdown to `expiresAt`; on expiry, swap to an "expired — generate new link" affordance that re-calls the endpoint. Use `cn()` for classes; shadcn/ui primitives where applicable.

#### 3. Inbox island (Realtime push)

**Files**: `src/components/InboxList.tsx`, `src/components/hooks/useLinks.ts`, `src/lib/supabase-browser.ts`

**Intent**: Render the user's links and append new ones the instant they're inserted — no polling.

**Contract**: A React island seeded with the SSR-fetched `initialLinks` (prop from `dashboard.astro`; do **not** re-fetch on mount). It opens a Supabase Realtime subscription to `postgres_changes` (`event: 'INSERT'`, `schema: 'public'`, `table: 'links'`, `filter: 'user_id=eq.<userId>'`) and prepends pushed rows to the list. Use a browser Supabase client built with `createBrowserClient` from `@supabase/ssr` (`src/lib/supabase-browser.ts`), constructed from the `supabaseUrl` + `supabaseAnonKey` props. The browser client reads the session from the cookies `@supabase/ssr` already set at sign-in, so the Realtime connection carries the user's JWT and RLS scopes the stream to their own rows. `useLinks.ts` owns the subscription lifecycle: subscribe on mount, `supabase.removeChannel(channel)` on unmount. Each row shows the URL (linked), relative `created_at`, and a "pending" badge while `processing_status = 'pending'` (a small badge component — note `LibBadge.astro` does **not** exist yet, so build a minimal badge). Empty state: a friendly "your inbox is empty — send a link to your bot" message. Mount on `dashboard.astro`.

**Why Realtime works across the trust boundary**: the bot inserts via the service-role client (bypassing RLS), but Realtime broadcasts every WAL change regardless of writer; RLS governs only the _subscriber's_ visibility (`links_select_authenticated`), so a pushed row reaches exactly the owning user's subscription and no one else's. No polling, so the idle-request waste of the original ~5s poll disappears entirely.

#### 4. Enable Realtime on `links`

**File**: `supabase/migrations/20260603130000_enable_realtime_links.sql`

**Intent**: Allow Postgres change events for `links` to be broadcast to subscribed clients.

**Contract**: `ALTER PUBLICATION supabase_realtime ADD TABLE public.links;`. No RLS change — per-user visibility is already enforced by `links_select_authenticated`, and Realtime honors it for subscribers. This is the only schema-side change Realtime needs (browser↔Supabase WebSocket is direct, never through the Worker).

### Success Criteria

#### Automated Verification

- Lint passes: `bun run lint`
- Build passes: `bun run build`
- Migration applies cleanly (Realtime publication): `bunx supabase db reset`

#### Manual Verification

- Account menu opens from the top-right; shows the correct email; sign-out works.
- "Connect Telegram" produces a clickable deep-link with a visible countdown; after 15 min it shows the expired/regenerate path and a new link works.
- After pairing, the menu shows "Connected ✅" on reload.
- With the bot running, sending a URL from Telegram makes the link appear in the inbox **near-instantly via Realtime push** (no manual reload, no polling); pending badge shown.
- A second signed-in account's inbox does **not** receive the first account's pushed rows (Realtime respects RLS).

**Implementation Note**: Pause for human confirmation before Phase 5.

---

## Phase 5: Bot registration + E2E verification

### Overview

Register the webhook with Telegram (with the secret), set the Cloudflare secrets, and run the full manual E2E checklist end-to-end against the deployed (or `wrangler dev` + tunnel) app.

### Changes Required

#### 1. Webhook registration + secrets (operational)

**File**: `context/changes/bot-capture-to-inbox/ops-setwebhook.md` (runbook)

**Intent**: Make the one-time external setup reproducible and documented.

**Contract**: A short runbook documenting: `wrangler secret put` for `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_USERNAME`; and the `setWebhook` call (`POST https://api.telegram.org/bot<token>/setWebhook` with `url` = `…/api/bot/webhook` and `secret_token` = the webhook secret). Note `getWebhookInfo` for verification. No app code change.

#### 2. E2E checklist

**File**: `context/changes/bot-capture-to-inbox/e2e-checklist.md`

**Intent**: A repeatable manual proof of the whole slice (per `/10x-e2e` principles, manual variant).

**Contract**: Ordered checklist covering: pair via deep-link → "Connected ✅"; send URL → "Saved ✅" + appears in inbox (right user, pending); unpaired sender refused, nothing stored; forged webhook (bad secret) rejected; expired token → bot says so + UI regenerates; ≤2s confirmation observed.

### Success Criteria

#### Automated Verification

- Lint passes: `bun run lint`
- Build passes: `bun run build`
- `getWebhookInfo` reports the correct URL and `pending_update_count` draining.

#### Manual Verification

- Full E2E checklist passes against a real Telegram bot.
- Confirmation latency is ≤2s in practice.
- A second account cannot see the first account's links (data isolation holds end-to-end).

**Implementation Note**: This phase completes the slice. After it passes, the change is ready for `/10x-impl-review` / archival.

---

## Testing Strategy

No automated test runner exists yet (`CLAUDE.md`), so S-01 is verified manually; Vitest units for the sensitive pure logic (URL extraction, secret compare, `telegram_id → user_id` resolve) are backfilled after S-02 lands the runner (roadmap Parked).

### Manual Testing Steps

1. Pair through the account menu deep-link; confirm "Connected ✅" and a `telegram_links` row.
2. Send a URL from Telegram; confirm "Saved ✅", a `pending` `links` row for the right user, and auto-refresh surfacing it in the inbox.
3. From an unpaired Telegram account, send a URL; confirm refusal and no row.
4. Replay a webhook `curl` with a wrong secret header; confirm `401`, no write.
5. Let a token expire; confirm the bot's expired reply and the UI's regenerate path.
6. With a second app account, confirm it cannot see the first account's links.

## Performance Considerations

The capture path is one mapping lookup + one insert + one `sendMessage` (+ a fire-and-forget enqueue) — comfortably within the ≤2s confirmation NFR. The Worker stays I/O-bound (no parsing/CPU work), avoiding the Workers CPU-limit pitfall noted in `infrastructure.md`. The inbox uses Supabase Realtime (browser↔Supabase WebSocket, direct — never through the Worker, per `infrastructure.md` §Realtime): new rows are pushed on insert, so there is **no** polling load at all; the only DB read is the one-time SSR seed on page render.

## Migration Notes

Two additive migrations: (1) the pairing tables (`pairing_codes`, `telegram_links`); (2) adding `links` to the `supabase_realtime` publication (membership only — no schema or data change to `links`). Forward-only — no data backfill. Rollback = drop the two pairing tables (no other object depends on them) and `ALTER PUBLICATION supabase_realtime DROP TABLE public.links`.

## References

- Roadmap slice + locked trade-offs: `context/foundation/roadmap.md` §S-01 (service-role decision, deferred enhancements)
- Tech-debt follow-up: Linear TAB-13 (service-role → `SECURITY DEFINER` RPC)
- Decisions & UX notes: `context/changes/bot-capture-to-inbox/change.md`
- Existing patterns: `src/pages/api/links/index.ts` (endpoint shape), `supabase/migrations/20260529120000_create_links.sql` (RLS pattern), `src/lib/supabase.ts` (client null-check contract)
- Lessons: `context/foundation/lessons.md` (RLS-is-not-a-contract; phase-gate ordering)
- API contract: `context/foundation/api-conventions.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data model + config foundation

#### Automated

- [x] 1.1 Migration applies cleanly: `bunx supabase db reset` — 30e14a2
- [x] 1.2 Lint passes: `bun run lint` — 30e14a2
- [x] 1.3 Build passes: `bun run build` — 30e14a2

#### Manual

- [x] 1.4 Both tables exist in Studio with RLS + expected policies
- [x] 1.5 RLS holds — other/anon user sees no rows

### Phase 2: Pairing end-to-end (token API + webhook `/start`)

#### Automated

- [x] 2.1 Lint passes: `bun run lint` — b495a4f
- [x] 2.2 Build passes: `bun run build` — b495a4f

#### Manual

- [x] 2.3 `POST /api/pairing` (signed in) returns deep-link + creates code row — b495a4f
- [x] 2.4 `POST /api/pairing` unauthenticated → `401` — b495a4f
- [x] 2.5 `/start <token>` with correct secret → mapping written, token burned, reply — b495a4f
- [x] 2.6 Wrong/absent secret header → `401`, no write — b495a4f
- [x] 2.7 Expired/used token → no mapping, "expired" reply — b495a4f

### Phase 3: Capture URL (webhook plain-message branch)

#### Automated

- [x] 3.1 Lint passes: `bun run lint`
- [x] 3.2 Build passes: `bun run build`

#### Manual

- [x] 3.3 Paired sender's URL → `pending` link for correct user + "Saved ✅"
- [x] 3.4 Unpaired sender → pairing instruction, no row
- [x] 3.5 No-URL message → "send a link" reply, no row
- [x] 3.6 Trust boundary — link attributed to mapped user, not payload-claimed id
- [x] 3.7 Saved link is enqueued (queue consumer logs `[queue] consumed describe`)

### Phase 4: Web UI — account menu pairing + inbox island

#### Automated

- [ ] 4.1 Lint passes: `bun run lint`
- [ ] 4.2 Build passes: `bun run build`
- [ ] 4.3 Migration applies cleanly (Realtime publication): `bunx supabase db reset`

#### Manual

- [ ] 4.4 Account menu opens (email + sign-out work)
- [ ] 4.5 Connect Telegram shows deep-link + countdown; expiry → regenerate works
- [ ] 4.6 Paired state shows "Connected ✅" on reload
- [ ] 4.7 Phone-sent URL appears in inbox near-instantly via Realtime push (no reload/poll), pending badge shown
- [ ] 4.8 Second account's inbox does not receive first account's pushed rows (Realtime respects RLS)

### Phase 5: Bot registration + E2E verification

#### Automated

- [ ] 5.1 Lint passes: `bun run lint`
- [ ] 5.2 Build passes: `bun run build`
- [ ] 5.3 `getWebhookInfo` shows correct URL + draining updates

#### Manual

- [ ] 5.4 Full E2E checklist passes against a real bot
- [ ] 5.5 Confirmation latency ≤2s observed
- [ ] 5.6 Second account cannot see first account's links
