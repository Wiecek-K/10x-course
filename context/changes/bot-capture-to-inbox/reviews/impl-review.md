<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Bot capture to inbox (S-01)

- **Plan**: context/changes/bot-capture-to-inbox/plan.md
- **Scope**: All 5 phases (full plan)
- **Date**: 2026-06-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

Automated gates green (lint exit 0, build exit 0). Migration-reset and manual E2E gates verified during implementation (SHAs 30e14a2, c497f01, 17138be; e2e-checklist.md §§1–9). Trust boundary, service-role isolation, and the Realtime JWT-before-subscribe fix are all correct.

## Findings

### F1 — sendMessage fetch unguarded → Telegram retry → duplicate insert

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/telegram.ts:6
- **Detail**: sendMessage awaits fetch with no try/catch and no res.ok check. The "Saved ✅" reply (webhook.ts:126) fires after the link insert; if that fetch throws, it bubbles to the APIRoute → 500 → Telegram redelivers the update → duplicate insert.
- **Fix**: Wrap the fetch in try/catch (log + swallow); a reply must never fail the webhook or trigger a retry.
- **Decision**: FIXED — try/catch around the sendMessage fetch (telegram.ts)

### F2 — Supabase lookup errors swallowed; real DB failure looks like "not paired"

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/bot/webhook.ts:57, 93
- **Detail**: Both lookups destructure only { data } and use .single(). A genuine DB/network failure on the telegram_links lookup is indistinguishable from "not paired" — a paired user gets "I don't know you yet" during an outage, nothing logged.
- **Fix**: Use .maybeSingle(), destructure error, log it, and reply "try again later" when error is set rather than the not-paired/expired message.
- **Decision**: FIXED — maybeSingle + error capture/log on both lookups (webhook.ts)

### F3 — URL extractor swallows trailing punctuation/markdown

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/lib/url.ts:2
- **Detail**: /https?:\/\/\S+/ greedily captures to the next whitespace, so "https://x.com/a)." stores the trailing ")." Share-sheet text (the case the plan called out) appends punctuation; saved links may 404.
- **Fix**: Strip trailing punctuation — match[0].replace(/[.,;:!?)\]}>'"]+$/, "").
- **Decision**: FIXED — trailing-punctuation strip in extractFirstUrl (url.ts)

### F4 — Inbox href has no scheme allowlist; z.url() allows javascript:

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Security)
- **Location**: src/components/InboxList.tsx:45, src/lib/schemas/links.ts:4
- **Detail**: InboxList renders <a href={link.url}> for every link including those from POST /api/links, whose CreateLinkSchema uses z.url() (accepts javascript:). Bot path is safe (extractFirstUrl anchored to https?://) and RLS scopes to owner, so blast radius is self-XSS — but it's a stored sink that shouldn't rely on React's href scrubbing.
- **Fix**: Tighten schema to http(s) (z.url() + protocol refine), or guard at render with startsWith("http") before binding href.
- **Decision**: FIXED — schema http(s) refine (schemas/links.ts) + safeHref render guard (InboxList.tsx)

### F5 — .env.example uses ### placeholders (violates recorded lesson)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: .env.example
- **Detail**: New secrets seeded with ###. Known rule: wrangler parses # as a comment → value becomes undefined → createAdminClient()/createClient() silently return null. Copying .env.example → .dev.vars verbatim yields a silently broken bot.
- **Fix**: Replace ### with a non-# placeholder, e.g. your-token-here.
- **Decision**: FIXED — descriptive non-# placeholders (.env.example)

### F6 — Pairing token consumption is non-atomic (TOCTOU; used_at unchecked)

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/bot/webhook.ts:57-81
- **Detail**: Select-then-update on pairing_codes; two concurrent /start <token> calls can both pass the used_at IS NULL select before either writes, and the update result (line 81) is discarded. Low real risk; single-use invariant not actually enforced.
- **Fix**: Make burn atomic — update({used_at}).eq("token",token).is("used_at",null).select().single(); treat 0 rows as already-used.
- **Decision**: FIXED — atomic consume-then-check update + best-effort re-open on upsert failure (webhook.ts)

### F7 — Unplanned migration 20260603121000_fix_links_rls_init_plan.sql

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: supabase/migrations/20260603121000_fix_links_rls_init_plan.sql
- **Detail**: Not in the plan. Rewrites links RLS policies to use (select auth.uid()) — standard Supabase perf fix; semantics unchanged; aligns with the pairing migration form; the SELECT policy gates Realtime delivery. Benign and arguably load-bearing; flagged as undocumented scope.
- **Fix**: Add a line to the plan's Migration Notes recording this policy-perf migration.
- **Decision**: FIXED + ACCEPTED-AS-RULE: "Migrations added during implementation must be written back into the plan" (lessons.md) — plan.md Migration Notes + rollback updated

### F8 — Webhook payload not zod-validated; message.chat.id unguarded

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/bot/webhook.ts:32, 38
- **Detail**: body cast `as TelegramUpdate` with no zod parse (canonical endpoint uses safeParse); message.chat.id read without a guard while from?.id is optional-chained. A malformed authentic update with message but no chat throws → 500 → retry. Real Telegram always sends chat, so low risk.
- **Fix**: Guard message.chat?.id (early 200 if absent), or zod-parse the update shape.
- **Decision**: FIXED — chat made optional + chatId undefined guard (webhook.ts)
