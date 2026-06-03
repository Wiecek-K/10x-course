<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Bot capture to inbox (S-01)

- **Plan**: `context/changes/bot-capture-to-inbox/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-03
- **Verdict**: REVISE → **SOUND** (after triage; all findings fixed)
- **Findings**: 1 critical · 2 warnings · 1 observation — all FIXED

## Verdicts

| Dimension | Verdict (initial) | After fixes |
|-----------|-------------------|-------------|
| End-State Alignment | PASS | PASS |
| Lean Execution | PASS | PASS |
| Architectural Fitness | FAIL (F1) | PASS |
| Blind Spots | WARNING (F2, F3) | PASS |
| Plan Completeness | PASS | PASS |

## Grounding

12/12 existing paths ✓, 8/8 new paths correctly absent, symbols ✓ (enqueueLink, LINK_QUEUE, set_updated_at, createClient), brief↔plan ✓, Progress↔Phase ✓. One contradiction surfaced and corrected during triage: Current State claimed F-02 was not on the branch, but `wrangler.jsonc` binds `LINK_QUEUE`, `main` is `src/worker.ts`, `src/lib/queue.ts` exports `enqueueLink`, and `POST /api/links` already calls it (F2).

## Findings

### F1 — pairing_codes RLS forbids the invalidation Phase 2 requires

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 §1 (RLS) vs Phase 2 §1 (pairing endpoint)
- **Detail**: Phase 1 grants `pairing_codes` only SELECT+INSERT for authenticated (no UPDATE/DELETE). Phase 2 §1 then asked the authenticated endpoint to "invalidate prior unused codes (delete or expire them)" — which silently affects 0 rows (the documented RLS-silent-failure lesson). "Only the latest link is live" never holds.
- **Fix A ⭐ Recommended**: Drop the invalidation step; rely on the 15-min TTL (webhook already validates `used_at IS NULL AND expires_at > now()`; stale codes self-expire). Leanest, minimal RLS surface on a secret table.
- **Fix B**: Add a scoped DELETE policy (authenticated, `auth.uid() = user_id`) to preserve "only latest live".
- **Decision**: FIXED via Fix A. Phase 2 §1 rewritten to not invalidate prior codes; bulk cleanup of expired/used rows deferred to **TAB-14** (Linear) + roadmap Parked entry.

### F2 — F-02 queue IS on this branch; bot links bypass the producer

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Current State Analysis & Phase 3 §1
- **Detail**: Plan stated "wrangler.jsonc has no queue/KV bindings (F-02 not on this branch)". The repo contradicts: `LINK_QUEUE` bound, `main: ./src/worker.ts` (worker delegates fetch to Astro so routes still work), `src/lib/queue.ts` exports `enqueueLink`, `POST /api/links` calls it. Consequence: Phase 3 inserts bot links directly via the admin client (not via `POST /api/links`), so bot-captured links were never enqueued — desktop links enqueued, bot links not. Once S-02 wires real processing, every bot link (the primary capture channel) would silently skip auto-description.
- **Fix A ⭐ Recommended**: Call `enqueueLink(data.id, user_id)` from the webhook after insert (best-effort/non-fatal, mirroring `POST /api/links`; consumer is a safe no-op stub today) + correct the Current State text. Symmetric paths, future-proofs S-02.
- **Fix B**: Leave insert direct; correct the text and document the divergence as known S-02 debt.
- **Decision**: FIXED via Fix A. Current State corrected; Phase 3 §1 enqueues after insert; verification + Progress item 3.7 added.

### F3 — Telegram /start param constraints not specified for the token

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §1 (token generation)
- **Detail**: Telegram's `/start` deep-link payload accepts only `[A-Za-z0-9_-]`, ≤64 chars. The plan said "URL-safe" — ambiguous; standard base64 (`+ / =`) or other encodings would silently break the deep-link (Telegram drops the payload, `/start` arrives token-less, pairing fails with no obvious cause).
- **Fix**: Specify base64url-without-padding (or hex), ≤64 chars (e.g. 32 random bytes → 43-char base64url); state the `[A-Za-z0-9_-]` + ≤64 constraint explicitly.
- **Decision**: FIXED. Phase 2 §1 now mandates `crypto.getRandomValues` ≥32 bytes encoded base64url-no-padding/hex with the explicit charset + length constraint.

### F4 — Inbox poll has no stop/visibility handling

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 §3 (InboxList / useLinks)
- **Detail**: The island polled `GET /api/links` every ~5s "while the tab is open" with nothing pausing it on a hidden/backgrounded tab — indefinite idle requests. Harmless at MVP scale but trivial to bound.
- **Fix (original)**: Pause polling on `document.visibilityState === "hidden"`; clear interval on unmount.
- **Decision**: FIXED via "Fix differently" → **Supabase Realtime push** (user-locked). Polling removed entirely. Phase 4 rewritten: SSR-seeded island + `postgres_changes` INSERT subscription filtered by `user_id`, browser client `src/lib/supabase-browser.ts` (`createBrowserClient`), publication migration `supabase/migrations/20260603130000_enable_realtime_links.sql`. Cross-trust-boundary note added (service-role insert still broadcasts; RLS scopes the subscriber). Performance Considerations, Migration Notes, and `change.md` decision updated; Progress renumbered (added 4.3 migration, 4.8 Realtime RLS isolation).

## Triage Summary

- **Fixed**: F1 (Fix A), F2 (Fix A), F3, F4 (Realtime redesign) — 4
- **Skipped / Accepted / Dismissed**: none
- **Verdict after fixes**: SOUND

### Side artifacts

- **TAB-14** (Linear, Backlog/Low, related TAB-7) — cleanup cron for expired/used `pairing_codes`: https://linear.app/tabnone/issue/TAB-14
- `roadmap.md` §Parked — cron-cleanup debt entry
- `linear-tasks.md` — TAB-14 registry row
- `change.md` — inbox decision locked to Realtime
