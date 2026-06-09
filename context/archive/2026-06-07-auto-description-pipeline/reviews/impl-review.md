<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auto-description Pipeline

- **Plan**: context/changes/auto-description-pipeline/plan.md
- **Scope**: All 5 phases
- **Date**: 2026-06-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Core pipeline solid; error taxonomy (null vs throw) correct in `firecrawl.ts`/`describe.ts` HTTP handling. Gaps were in the consumer's DB-error handling (same taxonomy broken at the DB boundary) plus a process-level scope-guardrail breach.

## Findings

### F1 — Link-lookup DB error swallowed → transient mis-acked as not-found

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/worker.ts:24
- **Detail**: `const { data: linkRow } = await ...single()` dropped `error`. A transient DB fault returns `data:null` → treated identically to "link deleted" → `msg.ack()` drops the job permanently, leaving the link stuck at `pending`. Violates the null-vs-throw taxonomy at the DB boundary.
- **Fix**: Switch to `.maybeSingle()` (0 rows → `data:null, error:null`; `error` only on real failure), capture `error`, `msg.retry()` on error, `msg.ack()` only on genuine not-found. `.maybeSingle()` chosen over `.single()` because `.single()` raises PGRST116 on 0 rows, which would wrongly retry genuinely-deleted links. Retry here is cheap — it precedes scrape/LLM, so no API credits burned.
- **Decision**: FIXED — `.maybeSingle()` + `lookupError → msg.retry()` (this review)

### F2 — Terminal-state write errors swallowed → row stuck forever

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/worker.ts:48, 57, 64
- **Detail**: `.update({ processing_status: "done"|"failed" })` return ignored. Supabase returns `{error}` (no throw), so a failed terminal write is silently swallowed → `ack()` → row stuck in `scraping`/`describing` ("eternal processing" in UI), no auto-recovery.
- **Tradeoff**: Mechanical fix is `retry()` on write error, but `retry()` restarts `queue()` from the top → re-scrape (Firecrawl credit) + re-LLM (tokens) just to repeat the write. Double cost for work already done. Option C (in-handler retry of the write only) closes the hole without double cost but adds code.
- **Decision**: ACCEPTED (Option B) — left as-is for MVP; "eternal processing" is an intentional diagnostic signal during dogfooding to gauge frequency/priority. Option C documented as parked roadmap item ("Odporność zapisu stanu końcowego w konsumerze") with rationale. (this review)

### F3 — Unguarded `JSON.parse` on LLM output → mis-classified as transient

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/describe.ts:83
- **Detail**: `JSON.parse(jsonText)` + `parsed.description.trim()` unguarded. Malformed/refusal payload throws → consumer catch → `msg.retry()` → burns all 3 retries on a non-retryable fault, row never reaches `failed`. `strict` json_schema makes this rare, not impossible.
- **Fix**: Wrap parse in try/catch, `return null` on parse failure (→ failed+ack).
- **Decision**: SKIPPED (accepted, LOW) — owner accepted all LOW-impact findings for MVP. Same taxonomy family as F1/F2; revisit alongside Option C if eternal-processing proves frequent.

### F4 — New migration violates "no new migrations" guardrail

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Scope Discipline
- **Location**: supabase/migrations/20260608153200_expand_processing_status.sql
- **Detail**: Plan §37 says "no new migrations (schema already supports everything)" and uses single interim status `processing`. Implementation expanded the enum to `pending|scraping|describing|done|failed`. Migration itself is safe (CHECK-only swap, RLS intact, `UPDATE processing→failed` before new constraint, no data loss). Issue is process: a guardrail-breaking scope expansion shipped without updating the plan.
- **Fix A ⭐ Recommended**: Document as plan addendum.
- **Decision**: FIXED-IN-PLAN (Option A) — addendum added to plan.md. Owner clarification: the status expansion was a fully conscious owner decision, not agent drift; the real error was at the plan-review stage (didn't catch that the 4-state enum was too coarse → worse UX, harder debugging). Addendum records this retroactively.

### F5 — Dev flags declared `access:"secret"`

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/mock.ts:1 · astro.config.mjs:31-32
- **Detail**: `USE_FIRECRAWL_MOCK`/`USE_LLM_MOCK` are dev feature flags, not secrets, but declared `access:"secret"` → pushed through CF secrets path, muddies secret surface.
- **Fix**: `access:"public"` (or boolean field).
- **Decision**: SKIPPED (accepted, LOW)

### F6 — Mock-flag drift vs plan; stale Progress checkboxes

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/services/mock.ts · plan.md:375-376
- **Detail**: Plan specified single `USE_API_MOCKS` + `isMockMode()`. Actual split per-API `USE_FIRECRAWL_MOCK`/`USE_LLM_MOCK` (commit 3c50f4c — sound improvement). Progress 2.3/2.4 still name `USE_API_MOCKS`.
- **Fix**: Update plan checkbox text to actual flag names.
- **Decision**: SKIPPED (accepted, LOW)

### F7 — `record-fixtures.ts` duplicates prompt + schema

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: scripts/record-fixtures.ts
- **Detail**: System prompt + json_schema copied verbatim instead of importing `DESCRIBE_EXAMPLES`/shared schema. Fixtures can silently diverge from production if examples change.
- **Fix**: Import `DESCRIBE_EXAMPLES` + share schema constant.
- **Decision**: SKIPPED (accepted, LOW)

### F8 — Batch destructure couples to `max_batch_size:1` implicitly

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/worker.ts:12
- **Detail**: `const [msg] = batch.messages` drops messages 2..n; safe only because `wrangler.jsonc` pins `max_batch_size:1`. Implicit coupling.
- **Fix**: Comment tying code to the batch-size-1 invariant.
- **Decision**: SKIPPED (accepted, LOW)

### F9 — Structured output + 5 real examples exceed plan spec

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/services/describe.ts · describe-examples.ts
- **Detail**: Plan said plain trimmed completion + "2-3 TODO placeholder" examples. Actual: json_schema structured output + 5 polished examples in extracted file. Benign improvement, documented (commit 3c50f4c). Positive drift only.
- **Decision**: ACCEPTED — no action (positive drift)
