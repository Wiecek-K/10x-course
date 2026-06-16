<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Testing Pipeline Units

- **Plan**: context/changes/testing-pipeline-units/plan.md
- **Scope**: Phases 1–4 of 4 (full plan)
- **Date**: 2026-06-16
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Verified: 62/62 tests pass (415ms); CI test step present (`ci.yml:17`); `format:check` clean; `lint` clean; `"fallback marker present"` removed from test-plan; no test-vs-source contract drift; all "What We're NOT Doing" boundaries respected.

## Findings

### F1 — Mixed @/ and ./ import style across test files

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/describe.test.ts:2,13
- **Detail**: describe.test.ts mixes alias and relative imports in one file — mocked dep via `@/lib/llm-key` (:2) but unit-under-test via `./describe` (:13). Other 4 test files all use relative `./` for the unit. CLAUDE.md says use `@/*` but literally forbids only `../../`; sibling `./` is defensible. The in-file mix is the real inconsistency. The `vi.mock("@/lib/llm-key")` path must mirror the source's import specifier to intercept — it stays aliased.
- **Fix**: Standardize unit-under-test imports to relative `./` (de-facto convention, 4/5 files); leave vi.mock specifiers matching the source's path.
- **Decision**: FIXED — root cause was no `@/` alias in `vitest.config.ts` (relative `./` SUT imports were the only thing that resolved; `@/lib/llm-key` only worked because fully mocked). Added `resolve.alias` `@` → `./src` to `vitest.config.ts` and converted all 5 test files' SUT imports to `@/...`, unifying on the CLAUDE.md `@/` convention. 63 tests green, lint+format clean.

### F2 — Unplanned Git Workflow section added to CLAUDE.md

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: CLAUDE.md (commit f88d415, Phase 4)
- **Detail**: Plan's CLAUDE.md intent was test commands only. The p4 commit also added a "Never commit directly to main..." Git Workflow section, unrelated to the test plan. Benign and additive (separate user request, S688), but EXTRA relative to plan scope and rode in on a test-infra commit, so the plan no longer fully describes the diff.
- **Fix**: Leave the rule (wanted) — no code change. Optional: note as addendum in the plan so the diff is fully accounted for.
- **Decision**: FIXED — added "Addendum (impl-review 2026-06-16)" note to plan.md Phase 4 documenting the unplanned CLAUDE.md Git Workflow rule. No code change.

### F3 — Misleading "transient classification" label on malformed-JSON test

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (test fidelity)
- **Location**: src/lib/services/describe.test.ts:85
- **Detail**: Test name/comment calls the malformed-JSON throw a "transient classification". Source (`describe.ts:83`) does NOT classify it as transient — `JSON.parse` throws a raw SyntaxError with no /transient/ message, unlike the deliberate 429/500 throws. The assertion (`.rejects.toThrow()`, no matcher) is correct and passes; only the label overstates a retry guarantee the code doesn't make. Plan line 288 carries the same loose wording.
- **Fix**: Rename to "throws (uncaught) on malformed JSON content"; drop the "transient" claim.
- **Decision**: FIXED — renamed test to "throws (uncaught) on malformed JSON in response content" (line 85). Plan line 288 wording left as-is (user chose test-only fix).

### F4 — Empty `choices: []` branch untested in describe

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/services/describe.test.ts (gap) · describe.ts:80
- **Detail**: `describe.ts:80` reads `data.choices[0]?.message?.content ?? ""`. No test sends `{choices:[]}` to hit the `?? ""` → null path. Plan said "every documented branch"; this is the one untested branch. All firecrawl branches covered.
- **Fix**: Add one case — 200 + `{choices:[]}` → null.
- **Decision**: FIXED — added "returns null when choices array is empty" test (describe.test.ts). Suite now 63 tests.
