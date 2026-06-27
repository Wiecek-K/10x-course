---
change_id: testing-capture-processing-integration
title: Capture + processing integration tests (webhook trust, enqueue parity, terminal state)
status: implementing
created: 2026-06-27
updated: 2026-06-27
archived_at: null
---

## Notes

Rollout Phase 2 of context/foundation/test-plan.md: "Capture + processing integration".
Integration tests with vendors mocked at the HTTP edge.

Risks covered:
- #1 — consumer reaches a terminal state, never stuck in `scraping`/`describing`. Prove scrape/LLM failure → terminal `failed` + link preserved (never stuck). Challenge: `ack()` after a failed terminal write must not look like success.
- #3 — webhook trust boundary. Prove forged webhook (bad shared secret) → 401; `user_id` resolved only from the trusted `telegram_id → user_id` mapping, never from the payload.
- #5 — enqueue parity. Prove a link captured through any channel ends up enqueued (insert row ≠ job done — the endpoint must enqueue).
