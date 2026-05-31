<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: F-01 Domain Data Foundation

- **Plan**: context/changes/domain-data-foundation/plan.md
- **Scope**: All phases (1–3 of 3)
- **Date**: 2026-05-31
- **Verdict**: NEEDS ATTENTION → all findings triaged & resolved
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Automated re-run: lint PASS · build PASS · file/flag checks PASS.
Manual criteria: all `[x]`, corroborated by session curl + RLS-isolation records.

Benign deviations (not findings): typed `createServerClient<Database>` client (improvement,
aligns with CLAUDE.md strong-typing), API route null-checks createClient → 500 (defensive),
`z.url()` (current Zod 4 API), eslint ignore of generated `database.types.ts`.

## Findings

### F1 — set_updated_at() has a mutable search_path

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260529120000_create_links.sql:2
- **Detail**: Trigger function defined without `SET search_path = ''` (Supabase `function_search_path_mutable` advisory). Function reused across future tables, so the gap propagates.
- **Fix**: New migration ALTERs the function: `ALTER FUNCTION public.set_updated_at() SET search_path = ''`.
- **Decision**: FIXED — added supabase/migrations/20260531223000_harden_set_updated_at_search_path.sql

### F2 — Raw DB error messages returned to client

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/links/index.ts:36, 63
- **Detail**: Both 500 paths returned Supabase `error.message` directly — can leak schema/constraint/RLS internals.
- **Fix**: Return generic `{ error: 'server_error' }`; log real message via `console.error` (Workers observability).
- **Decision**: FIXED — generic 500 + eslint-disabled console.error in both handlers

### F3 — Committed dev artifact with auto-generated name

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: supabase/snippets/Untitled query 636.sql
- **Detail**: Supabase Studio scratch query committed (354140a) outside F-01 scope with throwaway default name.
- **Fix**: Untrack from git + add `supabase/snippets/` to .gitignore.
- **Decision**: FIXED — `git rm --cached` + .gitignore rule. On-disk file is root-owned; user to `sudo rm -rf supabase/snippets/`.

### F4 — Validation runs before auth check

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality / Plan Adherence
- **Location**: src/pages/api/links/index.ts (POST & GET)
- **Detail**: Both handlers Zod-validated input before checking `locals.user` (matched plan order). Auth-first is the safer convention downstream slices (S-01/S-05) will copy.
- **Fix**: Move the 401 auth check to the top of both handlers, before JSON parse / safeParse.
- **Decision**: FIXED — auth-first in both POST and GET

### F5 — Inconsistent `as Link` cast between POST and GET

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/links/index.ts (POST return vs GET return)
- **Detail**: GET returns `data as Link[]`; POST returned raw `data`.
- **Fix**: Originally proposed `data as Link` on POST. ESLint type-checker (`no-unnecessary-type-assertion`) proved the cast is unnecessary on POST — the `<Database>`-typed client already types `.single()` `data` as Link-compatible; only GET's conditional-query path needs the assertion. False finding.
- **Decision**: SKIPPED (false positive) — POST left as raw `data`, which is correct.
