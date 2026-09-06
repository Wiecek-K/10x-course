<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Link Closure Flow (S-04)

- **Plan**: context/changes/link-closure-flow/plan.md
- **Scope**: All 4 phases (status: implemented)
- **Date**: 2026-06-27
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical · 3 warnings · 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Realtime DELETE listener never fires (replica identity PK-only)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/components/hooks/useLinks.ts:38-43 · supabase/migrations/20260603130000_enable_realtime_links.sql
- **Detail**: DELETE listener filters `user_id=eq.${userId}`. `links` is published with default replica identity (PK only), so DELETE WAL `old` carries only `id` — `user_id` absent, filter never matches, events never delivered. Cross-tab/cross-device delete propagation (desired-end-state + criterion 2.5) silently broken. Originating tab unaffected (optimistic remove). Criterion 2.5 still unchecked in plan — never verified, consistent with being broken. Matches lesson "SUBSCRIBED ≠ events flow".
- **Fix A ⭐ Recommended**: Filter the DELETE listener on `id` only, drop user_id filter; local removal is id-matched + idempotent so foreign deletes are harmless no-ops.
  - Strength: No migration, no WAL cost; filter on DELETE is unreliable by design (PK-only payload).
  - Tradeoff: Channel receives every user's DELETE events (tiny table; client-side no-op).
  - Confidence: HIGH — id always in PK payload.
  - Blind spot: Mixed filter across events slightly inconsistent to read.
- **Fix B**: Add `ALTER TABLE public.links REPLICA IDENTITY FULL;` migration.
  - Strength: Keeps user_id filter uniform across events.
  - Tradeoff: Full old-row in every WAL record → larger WAL; new migration to remote.
  - Confidence: HIGH — standard Supabase fix.
  - Blind spot: WAL-size impact unmeasured (negligible at scale).
- **Decision**: FIXED via Fix B — migration 20260627022500_links_replica_identity_full.sql + plan Migration Notes addendum. Needs `bunx supabase db push` to remote.

### F2 — Deferred DELETE is fire-and-forget; no rollback on failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence (Data safety)
- **Location**: src/components/hooks/useLinkActions.ts:104-107 (+ unmount 24-33)
- **Detail**: `removeWithUndo`'s 5s timer and the unmount path both `void fetch(DELETE)` with no `.ok`/`.catch`. On server failure the row was already optimistically removed and is never restored → client shows gone, DB still has it. Plan's Critical Implementation Details says "On PATCH/DELETE failure, roll back the optimistic change and surface an error"; `removeImmediately` does this, deferred path does not. Contract drift.
- **Fix**: await the DELETE in the timer; on non-2xx/non-404 call `restoreLink(entry.link)` (+ toast where UI mounted). Unmount path restore-or-log.
- **Decision**: FIXED via option B (honor-intent) — added `fireDeleteWithRetry(id)` helper: awaits DELETE with `keepalive: true`, retries once on non-2xx/non-404, logs on terminal failure (no zombie-resurrect). Wired into both the 5s timer and the unmount cleanup. keepalive also fixes the latent unmount-fetch-cancellation gap.

### F3 — Undo window equals delete timer (5000ms == 5000ms)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/components/hooks/useLinkActions.ts:104 · src/components/InboxList.tsx:49
- **Detail**: Toast duration and DELETE timer both 5000ms. Undo click at boundary races the delete — entry may already be gone, undo silently no-ops.
- **Fix**: Set delete timer slightly longer than toast (e.g. 5500ms) so undo window always closes before delete fires.
- **Decision**: FIXED — delete timer bumped to 5500ms (toast stays 5000ms).

### F4 — markVisited fetch has no .catch (unhandled rejection)

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/components/hooks/useLinkActions.ts:69-75
- **Detail**: `void fetch(PATCH {visited:true})` with no `.catch` → network rejection is an unhandled promise rejection. Navigation never blocked (anchor target="_blank", no preventDefault — verified).
- **Fix**: Append `.catch(() => {})` to the fire-and-forget visit PATCH.
- **Decision**: FIXED — `.catch(() => {})` appended to markVisited.

### F5 — PATCH response not cast `as Link` (boundary-cast convention)

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/links/[id].ts:54
- **Detail**: PATCH returns `Response.json(data)` raw. Plan said "Cast the returned row `as Link`"; sibling index.ts:78 casts `data as Link[]`. Functionally fine, breaks documented query-boundary-cast pattern.
- **Fix**: Return `data as Link` to match index.ts convention.
- **Decision**: DISMISSED — cast is rejected by `@typescript-eslint/no-unnecessary-type-assertion`. The `.update().select().single()` boundary already returns a `Link`-typed row (unlike `index.ts` where `data` is a wider array shape needing `as Link[]`). Original uncast code is correct; the plan's "cast as Link" note doesn't apply to this single-row path.

### F6 — button.tsx regenerated by shadcn (unplanned)

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/ui/button.tsx:3,50
- **Detail**: `bunx shadcn add` regenerated button.tsx: Slot import swapped `@radix-ui/react-slot` → `radix-ui` barrel, added unused size variants (xs/icon-*), dropped shadow-xs. Not in plan, unused by new components. Benign, unplanned dependency-surface change.
- **Fix**: Accept as-is (standard shadcn output) — no action needed; noting for the record.
- **Decision**: ACCEPTED — standard shadcn regen, benign; left as-is.

### F7 — format:check fails on committed .playwright-cli/*.yml artifacts

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: .playwright-cli/*.yml (15 files in working tree)
- **Detail**: `bun run format:check` exits 1 — only on accumulating `.playwright-cli/` snapshot artifacts, zero feature source files. Committed code passed format at commit time; artifact pollution (also clutters git status with ~28 yml).
- **Fix**: Add `.playwright-cli/` to .gitignore (and untrack existing) or `.prettierignore`, so the gate reflects source only.
- **Decision**: FIXED — added `.playwright-cli/` to .gitignore and `git rm --cached` the 14 tracked snapshots. `format:check` now passes (zero stray files).
