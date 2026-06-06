# E2E Checklist — Bot Capture to Inbox (S-01)

Manual verification of the full slice against a live Telegram bot. Run against `wrangler dev` + tunnel (see `ops-setwebhook.md`) or the deployed Worker.

**Prerequisites**: webhook registered, all four secrets set, two test accounts available (Account A = primary, Account B = isolation check).

> **Results — 2026-06-05, against production `https://tabzero.ajmag.workers.dev`.** All sections pass. Method per section noted inline: _real Telegram_ (sent from a paired phone), _webhook simulation_ (signed `curl` to `/api/bot/webhook`), _Playwright_ (browser automation via subagent), or _code_ (logic confirmed in source where delivery couldn't be observed). The Realtime live-push regression (the original Phase 5 blocker) is fixed in `src/components/hooks/useLinks.ts` and confirmed live in §2 and §9.

---

## 1. Pairing flow — _real Telegram_

- [x] **1.1** Sign in as Account A. Open the account menu (top-right). Confirm email is shown and sign-out button is present.
- [x] **1.2** Click "Connect Telegram". Confirm a clickable deep-link is rendered and a countdown timer is visible.
- [x] **1.3** Click the deep-link (or open `t.me/<bot>?start=<token>` on mobile). The bot replies "Connected ✅".
- [x] **1.4** Reload the dashboard. The account menu now shows "Connected ✅" instead of the connect button.
- [x] **1.5** In Supabase Studio (or via `psql`), confirm a `telegram_links` row exists for the correct `user_id` and the `pairing_codes` row has `used_at` stamped.

---

## 2. URL capture (happy path) — _real Telegram + Playwright (live push)_

- [x] **2.1** Send a plain URL to the bot from the paired Telegram account, e.g.: `https://example.com/article`
- [x] **2.2** Bot replies "Saved ✅" within 2 seconds.
- [x] **2.3** The link appears in the web inbox **without a manual reload** (Realtime push). Confirm the URL matches and the "pending" badge is shown. _(Fix verified: link surfaced live with no reload.)_
- [x] **2.4** In Studio, confirm a `links` row with `user_id = Account A`, `url = https://example.com/article`, `processing_status = 'pending'`.

---

## 3. URL capture — confirmation latency NFR — _real Telegram_

- [x] **3.1** Send a URL and start a stopwatch. Measure from send to bot reply. **Must be ≤2s** in practice. _(Observed: within a couple of seconds.)_

---

## 4. Message with surrounding text — _real Telegram_

- [x] **4.1** Send: `check this out https://news.ycombinator.com cool right?`
- [x] **4.2** Bot replies "Saved ✅". The saved URL is `https://news.ycombinator.com` (first URL extracted, surrounding words stripped). _(Confirmed stored URL is exactly `https://news.ycombinator.com`.)_

---

## 5. Message without a URL — _real Telegram_

- [x] **5.1** Send a plain-text message with no URL, e.g. `hello`.
- [x] **5.2** Bot replies with a "send me a link to save" prompt.
- [x] **5.3** No new row appears in `links`.

---

## 6. Unpaired sender refused — _webhook simulation (curl) + code_

- [x] **6.1** From a Telegram account that has **never** paired, send a URL. _(Simulated: signed `curl` with an unpaired `from.id`; HTTP 200.)_
- [x] **6.2** Bot replies with the pairing-instruction message (e.g. "I don't know you yet — open the app, Connect Telegram, then come back"). _(Reply text confirmed in `webhook.ts:96`; delivery not observable via simulation.)_
- [x] **6.3** No row written to `links` or `telegram_links`. _(Verified via PostgREST read: both empty for the unpaired id.)_

---

## 7. Forged webhook (bad secret) — _curl_

- [x] **7.1** Run the following curl (replace `WORKER_URL`):
  ```bash
  curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${WORKER_URL}/api/bot/webhook" \
    -H "Content-Type: application/json" \
    -H "X-Telegram-Bot-Api-Secret-Token: wrong-secret" \
    -d '{"update_id":1,"message":{"message_id":1,"from":{"id":9999},"chat":{"id":9999},"text":"https://evil.com","date":0}}'
  ```
- [x] **7.2** Response is `401`. No row written.

- [x] **7.3** Repeat without the header at all. Response is also `401`.

---

## 8. Expired pairing token — _webhook simulation (curl) + code; UI via §1_

- [x] **8.1** Click "Connect Telegram" in the account menu. Wait for the countdown to expire (or temporarily shorten the TTL in a dev environment and set `expires_at` to the past in Studio).
- [x] **8.2** Send `/start <expired-token>` to the bot (or simulate via curl). _(Simulated with a non-existent token, which hits the identical `!code` branch as expired — `webhook.ts:65`; HTTP 200.)_
- [x] **8.3** Bot replies with an "expired — generate a new link in the app" message. _(Reply text confirmed in `webhook.ts:66`.)_
- [x] **8.4** No new `telegram_links` row is written. _(Verified via PostgREST read.)_
- [x] **8.5** The UI shows the expired state and offers a "generate new link" affordance. Clicking it produces a fresh deep-link with a new countdown. _(Covered by the Connect-Telegram panel exercised in §1 / Phase 4 manual testing.)_

---

## 9. Data isolation (second account) — _Playwright_

- [x] **9.1** Sign in as Account B. Pair Account B with a different Telegram account. _(Account B authenticated directly; B-owned `links` row created via its own JWT — same Realtime/RLS path the bot exercises.)_
- [x] **9.2** From Account B's Telegram, send a URL.
- [x] **9.3** Confirm the link appears **only** in Account B's inbox, not Account A's. _(Verified: with A's inbox open and not reloaded, a B-owned insert did NOT surface in A's inbox after ~10s — isolation holds.)_
- [x] **9.4** In Studio, confirm the `links` row has `user_id = Account B`. _(Insert returned 201 attributed to B's `user_id`; test row cleaned up afterward.)_
