---
change_id: bot-capture-to-inbox
title: Bot capture to inbox (Telegram → link in inbox + minimal inbox view)
status: in_progress
created: 2026-06-03
updated: 2026-06-03
archived_at: null
---

## Notes

S-01: user sends a URL to the Telegram bot and sees it appear in the web app inbox (URL only; description comes in S-02). Introduces Telegram bot setup, pairing code identity binding (telegram_id → user_id), POST /api/bot/message webhook, and a minimal inbox view on the dashboard.
