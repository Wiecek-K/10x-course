# Bot capture to inbox (S-01) — Plan Brief

> Full plan: `context/changes/bot-capture-to-inbox/plan.md`
> Decisions & UX notes: `context/changes/bot-capture-to-inbox/change.md`

## What & Why

Add a Telegram capture channel: the user links Telegram to their account once, then "paste a URL into the bot → it's in the inbox". This is the second half of the wedge-proof chain (F-01 → **S-01** → S-02) and the first user-facing slice — it makes mobile capture real so dogfooding can begin. S-01 stores the URL only; the auto-description is S-02.

## Starting Point

F-01 is done: the `links` table (RLS per `user_id`, `processing_status` defaults `pending`, `in_library=false`=inbox), `POST/GET /api/links`, cookie-based Supabase auth (`src/lib/supabase.ts` + `middleware.ts`), and a placeholder dashboard. No Telegram, no pairing, no inbox UI yet. F-02's queue is not on this branch and is not needed (S-01 doesn't enqueue).

## Desired End State

A paired user sends any message containing a URL to the bot and gets "Saved ✅" within ~2s; the link appears (auto-refreshing) in the web inbox as `pending`. Pairing is a one-time deep-link click from a top-right account menu, with a clear regenerate path if the token expires. Unpaired senders are told how to pair; forged webhook calls are rejected.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Bot integration | Telegram webhook + raw `fetch` | Zero deps, fits Workers + capacity blocker | Plan |
| Identity binding | Deep-link `t.me/<bot>?start=<token>` | One-click setup, strong token, no manual code | Plan |
| Link insert (no session) | Service-role client, RLS bypass | Simplest for MVP; webhook has no `auth.uid()` | Roadmap/TAB-13 |
| → long-term replacement | `SECURITY DEFINER` RPC | Confine privilege to one SQL function | Roadmap/TAB-13 |
| Webhook auth | `secret_token` header + known-`telegram_id` gate | Native Telegram mechanism, defense-in-depth | Plan |
| Data model | `pairing_codes` (ephemeral) + `telegram_links` (permanent) | Clean split of one-time token vs lasting mapping | Plan |
| Unpaired sender | Refuse + instruct; don't store | No orphaned links; clear onboarding | Plan |
| Duplicates | Save every time, no dedup | Some users value the signal; settings-based dedup is post-MVP | Plan |
| URL extraction | First http(s) URL in the message | Share-sheets append titles/text | Plan |
| Inbox | React island, auto-refresh | Phone-sent link appears on desktop without F5 | Plan |
| Pairing UI | Top-right account menu popover | Email + sign-out + Connect Telegram + regenerate | Plan |
| Verification | Manual E2E now; Vitest after S-02 | No test runner in repo yet | Roadmap |

## Scope

**In scope:** two pairing tables + RLS; service-role helper; `POST /api/pairing` (token + deep-link); bot webhook (pairing `/start` + URL capture + unpaired handling); account-menu pairing UI with expiry/regenerate; auto-refreshing inbox; webhook registration + manual E2E.

**Out of scope:** scraping/LLM/queue (S-02), dedup, multi-URL, description-on-capture, closure/edit/visit-tracking (S-04), `SECURITY DEFINER` RPC (TAB-13), automated test runner, non-Telegram platforms.

## Architecture / Approach

Two identities nobody holds together — web knows `user_id` (cookie), Telegram knows `telegram_id` (in every webhook). Pairing stitches them once: web mints a one-time token in `pairing_codes` and shows a deep-link; clicking it sends `/start <token>` to the bot webhook, which resolves `token → user_id`, writes the permanent `telegram_links` mapping, and burns the token. Daily capture then needs no web app: webhook verifies the `secret_token`, resolves `telegram_id → user_id` from the mapping, extracts the first URL, and inserts a `pending` link via the **service-role** client (the only RLS-bypassing path, confined to one module). The inbox island polls `/api/links`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data + config | `pairing_codes` + `telegram_links` (RLS), types, secrets, admin client | RLS policy correctness on the new tables |
| 2. Pairing end-to-end | `POST /api/pairing` + webhook `/start` → mapping written | Webhook auth + token consumption correctness |
| 3. Capture URL | Webhook plain-message → `pending` link; unpaired handling | Trust boundary: attribute link to mapped user only |
| 4. Web UI | Account-menu pairing (expiry/regenerate) + auto-refresh inbox | Token-expiry UX; island state |
| 5. Registration + E2E | `setWebhook` + secrets + manual E2E checklist | External setup; ≤2s latency; data isolation |

**Prerequisites:** F-01 (done); a registered Telegram bot (token + username); Cloudflare secrets set.
**Estimated effort:** ~3–5 focused sessions across 5 phases; phase 2–3 (the webhook) carry most of the risk.

## Open Risks & Assumptions

- Service-role key bypasses **all** RLS — blast radius is the whole DB if it leaks. Mitigated by confining it to one module + the `telegram_id` gate; tracked for replacement (TAB-13).
- Manual-only verification can miss regressions in the sensitive auth/parse logic — accepted now, backfilled with Vitest after S-02.
- PRD has no literal user story for bot capture (US-01 is desktop-only) — planned from FR-002 + FR-010; doc gap noted in roadmap Open Questions.

## Success Criteria (Summary)

- Pair once via deep-link, then send a URL from Telegram and see it in the web inbox as `pending`, with ≤2s confirmation.
- Unpaired senders are guided, forged webhook calls rejected, expired tokens recoverable from the UI.
- One user never sees another user's links (data isolation holds end-to-end).
