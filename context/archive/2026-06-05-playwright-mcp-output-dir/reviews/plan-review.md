<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Pin Playwright MCP Artifact Output

- **Plan**: context/changes/playwright-mcp-output-dir/plan.md
- **Mode**: Deep (source + live-probe grounded; see research.md)
- **Date**: 2026-06-06
- **Verdict**: REVISE → SOUND (all findings fixed in plan)
- **Findings**: 1 critical, 2 warnings, 2 observations

## Verdicts

| Dimension             | Verdict (pre-fix)               |
| --------------------- | ------------------------------- |
| End-State Alignment   | FAIL (F1) → resolved            |
| Lean Execution        | WARNING (F2) → resolved         |
| Architectural Fitness | PASS                            |
| Blind Spots           | WARNING (F1) → resolved         |
| Plan Completeness     | WARNING (F3, F4, F5) → resolved |

## Grounding

Paths ✓ · mechanism verified against installed source (`@playwright/mcp` 0.0.75,
`playwright-core` `coreBundle.js`) + live probe (`research.md`) · brief↔plan ✓.
KEY REVERSAL: the first-pass F1 (absolute path basename-sanitized to root) was REFUTED —
the convention works; a different gap (ENOENT, no committed dir) is the real blocker.

## Findings

### F1 — Convention fails with ENOENT on a fresh clone (dir never created)

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment / Blind Spots
- **Location**: Phase 1 §1 (.gitignore) + §2 (CLAUDE.md convention)
- **Detail**: A path under `playwright-artifacts/` resolves correctly (live probe), but the
  screenshot write goes through `workspaceFile()` (`coreBundle.js:58227-58232`) which does
  NOT `mkdir` (only `outputFile()` does, :58244). `playwright-artifacts/` is gitignored and
  git doesn't track empty dirs, so it's absent on a fresh clone — both absolute and relative
  probes failed with ENOENT. As written, the end state isn't reached.
- **Fix**: Commit `playwright-artifacts/.gitkeep`; change `.gitignore` to
  `playwright-artifacts/*` + `!playwright-artifacts/.gitkeep`; add an automated check that
  the placeholder is tracked and the dir is not ignored.
- **Decision**: FIXED (Fix in plan) — §1 contract rewritten with the negation pattern +
  committed `.gitkeep` + verified rationale; Success Criteria/Progress 1.1 and 1.4 updated.

### F2 — "Optional --output-dir hardening" is the wrong lever

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Lean Execution / Plan Completeness
- **Location**: Phase 1 §3 (change.md hardening note)
- **Detail**: `--output-dir` / `PLAYWRIGHT_MCP_OUTPUT_DIR` only affects the auto-named path
  (`outputFile → outputDir`, default `.playwright-mcp/`, already gitignored). The bare-filename
  bug routes through `workspaceFile → cwd` (repo root) and is unaffected. Documenting it as
  "hard enforcement opt-in" is misleading.
- **Fix**: Rewrite §3 to state the real enforcement is convention + gitignore net + committed
  dir; `--output-dir` only relocates auto-named artifacts, not the bare-filename case.
- **Decision**: FIXED (Fix in plan) — §3 retitled and rewritten.

### F3 — Convention overspecifies "absolute path"; misses leaner options

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §2 (CLAUDE.md convention), Current State Analysis
- **Detail**: Any path with the `playwright-artifacts/` prefix works (absolute OR relative);
  omitting `filename` auto-saves to gitignored `.playwright-mcp/`. Only a bare name hits root.
  Mandating absolute-only is needlessly strict and misses the zero-infra "omit filename" option.
- **Fix**: Reword the convention (prefix abs-or-relative, or omit filename); correct the
  Current State Analysis mechanism sentence.
- **Decision**: FIXED (Fix in plan) — §2 Intent/Contract + Current State Analysis updated.

### F4 — Evidence cites .claude/settings.json; file is settings.local.json

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis, Key Discoveries, References
- **Detail**: Plan references `.claude/settings.json:21-31`; the file is
  `.claude/settings.local.json` (claim correct, filename wrong).
- **Fix**: Correct the references.
- **Decision**: FIXED (Fix in plan) — 3 references updated to `settings.local.json`.

### F5 — gitignore net + verification cover .png only, not jpeg

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §1, Success Criteria 1.2
- **Detail**: `browser_take_screenshot` emits jpeg when `type=jpeg`; the bare-filename slip
  could be a `.jpg`. Net + verification only covered `/*.png`.
- **Fix**: Add `/*.jpg` and `/*.jpeg` to the net and the verification greps.
- **Decision**: FIXED (Fix in plan) — gitignore block + SC 1.2 + Progress 1.2 updated.
