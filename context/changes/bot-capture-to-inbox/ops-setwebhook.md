# Ops Runbook — Telegram Webhook Registration

One-time setup to wire the deployed Worker to Telegram and confirm the connection.

---

## 1. Set Cloudflare secrets

Run each command and paste the real value when prompted. All four are required before the Worker will accept any Telegram update.

```bash
bunx wrangler secret put TELEGRAM_BOT_TOKEN
bunx wrangler secret put TELEGRAM_WEBHOOK_SECRET
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
bunx wrangler secret put TELEGRAM_BOT_USERNAME
```

- **`TELEGRAM_BOT_TOKEN`** — from BotFather (`/mybots` → select bot → API Token).
- **`TELEGRAM_WEBHOOK_SECRET`** — a strong random string you choose; the Worker checks this in `X-Telegram-Bot-Api-Secret-Token`. Generate with:
  ```bash
  openssl rand -hex 32
  ```
- **`SUPABASE_SERVICE_ROLE_KEY`** — from Supabase dashboard → Project Settings → API → `service_role` key.
- **`TELEGRAM_BOT_USERNAME`** — the `@handle` without the `@`, e.g. `mytabzerobot`. Used to build the deep-link in the pairing response.

> **Security note**: `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS. Never expose it in client code or logs. The Worker is the only place it should ever appear.

---

## 2. Deploy the Worker

If not already deployed:

```bash
bunx wrangler deploy
```

Note the deployed URL, e.g. `https://tabzero.<account>.workers.dev`.

---

## 3. Register the webhook with Telegram

Replace the placeholders and run:

```bash
BOT_TOKEN="<your-bot-token>"
WEBHOOK_URL="https://tabzero.<account>.workers.dev/api/bot/webhook"
SECRET="<your-webhook-secret>"   # must match TELEGRAM_WEBHOOK_SECRET above

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WEBHOOK_URL}\",
    \"secret_token\": \"${SECRET}\",
    \"allowed_updates\": [\"message\"]
  }" | jq .
```

Expected response:

```json
{ "ok": true, "result": true, "description": "Webhook was set" }
```

---

## 4. Verify the webhook

```bash
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | jq .
```

Key fields to confirm:

| Field                    | Expected                    |
| ------------------------ | --------------------------- |
| `url`                    | `https://…/api/bot/webhook` |
| `has_custom_certificate` | `false`                     |
| `pending_update_count`   | `0` (or draining toward 0)  |
| `last_error_message`     | absent / empty              |

If `pending_update_count` stays above 0 and `last_error_message` appears, check Worker logs:

```bash
bunx wrangler tail
```

---

## 5. Remove / update the webhook

To point at a different URL (e.g. a staging env):

```bash
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=https://staging.…/api/bot/webhook&secret_token=${SECRET}" | jq .
```

To remove entirely (disables incoming updates):

```bash
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook" | jq .
```

---

## Local dev (wrangler dev + tunnel)

Telegram requires a public HTTPS URL — `localhost` will not work. Options:

- **ngrok**: `ngrok http 8788` → use the `https://…ngrok-free.app` URL in `setWebhook`.
- **Cloudflare Tunnel**: `cloudflared tunnel --url http://localhost:8788`.

Re-run `setWebhook` each time the tunnel URL changes. Tunnel URLs from free ngrok plans change on restart.
