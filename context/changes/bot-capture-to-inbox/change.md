---
change_id: bot-capture-to-inbox
title: Bot capture to inbox (Telegram → link in inbox + minimal inbox view)
status: implementing
created: 2026-06-03
updated: 2026-06-04
plan: planned
archived_at: null
---

## Notes

S-01: user sends a URL to the Telegram bot and sees it appear in the web app inbox (URL only; description comes in S-02). Introduces Telegram bot setup, pairing code identity binding (telegram_id → user_id), POST /api/bot/message webhook, and a minimal inbox view on the dashboard.

## Decisions (locked during /10x-plan)

- **Bot integration:** Telegram webhook + raw `fetch` to Bot API (no library).
- **Webhook auth:** Telegram `secret_token` sent in `X-Telegram-Bot-Api-Secret-Token` header, verified constant-time. Plus defense-in-depth: only a known `telegram_id` (present in `telegram_links`) can ever insert.
- **Link insert (no Supabase session):** dedicated service-role client confined to the bot module — bypasses RLS. Conscious tech debt; replace with `SECURITY DEFINER` RPC post-MVP. Tracked: roadmap S-01 + Linear TAB-13.
- **Identity binding:** Telegram deep-link `t.me/<bot>?start=<token>`. Web app generates a one-time token → user clicks → Telegram delivers `/start <token>` to the bot → bot resolves `token → user_id`, writes the permanent `telegram_id → user_id` mapping, burns the token. One-time setup; daily capture is then frictionless (paste URL → done).
- **Data model:** two tables — `pairing_codes` (token, user_id, expires_at, used_at; ephemeral, TTL ~15 min, single-use) and `telegram_links` (telegram_id PK, user_id; permanent mapping).
- **Unpaired sender:** bot refuses and instructs how to pair ("I don't know you yet — open the app, click Connect Telegram, come back"). The URL is NOT stored; user resends after pairing. No orphaned-link buffering.
- **Inbox view:** React island seeded by SSR + **Supabase Realtime** subscription (`postgres_changes` INSERT on `links`, filtered by `user_id`) so a link sent from the phone appears on the desktop instantly, no polling. Lives on the dashboard. _(Locked 2026-06-03 during plan-review: Realtime over polling — the Realtime client already ships in `@supabase/supabase-js`, `infrastructure.md` blesses the browser→Supabase WS path, and a service-role bot insert still broadcasts to the owning user's subscription because RLS governs subscriber visibility. Removes idle-poll waste. Cron cleanup of `pairing_codes` deferred to TAB-14.)_
- **Pairing UI placement:** a user/account menu opened from a button in the top-right corner (classic account popover — shows email, sign-out, and the "Connect Telegram" pairing entry). The expired-token recovery (active/expired state + "generate new link") lives inside this panel.
- **URL extraction:** take the first valid http(s) URL found in `message.text`; ignore surrounding text (share-sheets from other apps often append a title/blurb). No URL → bot asks for a link.
- **Duplicates:** save every time, no dedup check at this stage — re-saving the same URL creates another link and is confirmed normally. (Some users value seeing they've saved something multiple times.)
- **Bot confirmation:** reply "Saved ✅" on success; server error → "Try again". No dedup message (duplicates just save).
- **Verification method:** manual E2E (no test runner in repo yet). Documented checklist in the plan: pair via deep-link, send URL, see it in inbox; webhook driven locally via `wrangler dev` + `curl` simulating a Telegram update; cover unpaired refusal and bad-secret rejection. Follow-up (roadmap Parked): after S-02 lands the test runner, backfill Vitest units for URL parsing, secret_token validation, and telegram_id→user_id resolve.

## Future enhancements (deferred — added to roadmap Parked)

- **User-controlled description on capture:** let the user steer the micro-description via a command/text when sharing a link. Open question: single message vs. a multi-step bot conversation. Post-MVP.
- **Duplicate-handling preference:** a settings option for what happens when a duplicate URL is sent (match UX to user preference). Needs research into what behaviors users actually prefer. Post-MVP.

## UX notes to honor in the plan

- **Expired-token recovery:** the pairing UI MUST handle the case where the user generates the deep-link but does NOT use it within the ~15 min TTL. They need a clear path to regenerate / get a fresh link — never a dead end. Surface link state (active / expired) and a "generate new link" affordance.
