<!-- PLAN-REVIEW-REPORT -->
# Plan Review: F-01 Domain Data Foundation

- **Plan**: `context/changes/domain-data-foundation/plan.md`
- **Mode**: Deep
- **Date**: 2026-05-29
- **Verdict**: SOUND (post-triage)
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

6/6 existing paths ✓ (4 planned paths correctly absent); symbols: createClient ✓, context.locals.user ✓, astro:env/server ✓, env.schema ✓; brief↔plan ✓

## Findings

### F1 — supabase/migrations/ directory does not exist

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Change #1
- **Detail**: `supabase init` created only `config.toml` and `.gitignore` — no `migrations/` directory. Phase 1 writes `supabase/migrations/20260529...sql` but never mentioned creating the parent directory.
- **Fix**: Added `mkdir -p supabase/migrations` note to Phase 1, Change #1 Intent.
- **Decision**: FIXED

### F2 — Link return type mismatch: Supabase row vs narrowed Link type

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Change #2 + Phase 3 Change #1
- **Detail**: `Link` is `Omit<Row, 'processing_status'> & { processing_status: ProcessingStatus }`. Supabase generates `processing_status: string`. Phase 3 query results are typed as `Row` — TypeScript rejects assigning to `Link` without a cast. Phase 3 contract was silent.
- **Fix A ⭐ Applied**: Added `as Link` / `as Link[]` assertion notes to Phase 3 contract for both POST and GET returns. Valid because DB CHECK constraint guarantees runtime value is always a valid `ProcessingStatus`.
- **Decision**: FIXED via Fix A

### F3 — Bare supabase (no bunx) in Critical Details and Progress 1.1–1.2

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details (line 75) + Progress items 1.1–1.2
- **Detail**: Two places used `supabase db reset` / `supabase db push` without `bunx`. Running bare `supabase` in a shell gives "command not found". Rest of plan uses `bunx supabase` consistently.
- **Fix**: Replaced both bare references with `bunx supabase`.
- **Decision**: FIXED

### F4 — Phase 3 supabase null check is dead code

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 Change #1 contract
- **Detail**: Middleware sets `context.locals.user = null` when `createClient` returns null. The API route's `!context.locals.user → 401` always fires first. The `→ 500 "Supabase is not configured"` branch was unreachable dead code.
- **Fix**: Removed null check from Phase 3 contract. Added note that middleware already handles this case via the 401 path.
- **Decision**: FIXED
