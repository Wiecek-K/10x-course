# Link Closure Flow (S-04) — Plan Brief

> Full plan: `context/changes/link-closure-flow/plan.md`
> Frame brief: `context/changes/link-closure-flow/frame.md`

## What & Why

Build the closure UX plus the two live-state transitions and two terminal deletions over
the existing `in_library boolean` model — NOT a 4-state status enum, and NOT (yet) a
closure event-log. The roadmap's "4-state lifecycle" label overstated it: only two states
are ever persisted (inbox / library); "consume-close" and "discard" are terminal events
that hard-delete the row.

## Starting Point

`links` already has `in_library boolean` and `last_visited timestamptz`, with owner-scoped
RLS. The API has only list + create — no single-resource PATCH/DELETE. The dashboard loads
all links unfiltered into one action-less inbox list; the realtime hook handles INSERT and
UPDATE but not DELETE. There is no library view and no `note` column.

## Desired End State

The dashboard shows an Inbox and a Library section. Inbox rows offer Keep / Consume-close /
Discard / Edit, plus a "visited — awaiting action" reminder after a link is opened.
Consume-close and Discard remove the row with an undo toast (hard-delete fires after the
window). Library rows offer Edit and a single confirm-gated "Remove from library". Edits go
through a shared modal (url, micro_description, note). Everything updates optimistically and
stays consistent across tabs.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| State model | 2 states (`in_library`) + 2 terminal deletes | Schema already encodes only two persisted states | Frame |
| Delete kind | Hard-delete | PRD FR-008 "link usuwany z bazy"; matches boolean model | Frame |
| Closure event-log | Deferred to future FR-012 slice | User-accepted: stats accrue from FR-012, not retroactively | Frame |
| Note column | Nullable `note` for kept rows only | A2/A5 need a persisted note; A3/A4 carry none | Frame |
| Library view | Filter inbox + lightweight library section | Gives A2 somewhere to land; reuses list, low cost | Plan |
| UI mutation reflection | Optimistic local + add realtime DELETE handler | Instant feedback + cross-tab consistency | Plan |
| Inbox delete UX | Optimistic remove + undo toast (deferred DELETE) | Fast triage flow with a safety net | Plan |
| Library delete UX | Confirm dialog (AlertDialog), immediate DELETE | Deliberate, irreversible removal from curated set | Plan |
| Library terminal actions | Single "Remove from library" | Consume/discard split is meaningless post-keep | Plan |
| Note entry timing | No prompt at A2; edit later via modal | Keeps the keep action one click | Plan |
| Edit UX | Shared shadcn Dialog (url, desc, note) | Clean single form, reused by inbox + library | Plan |
| Action layout | Inline buttons per row | Actions visible without an extra click | Plan |

## Scope

**In scope:** `note` migration; `/api/links/[id]` PATCH+DELETE; realtime DELETE handler;
optimistic mutation hook with deferred-delete undo; dashboard split into inbox + library;
inbox actions (A2–A5) + visit (A1) + visited reminder; shared edit modal; library list with
confirm-gated single delete; roadmap deferral note.

**Out of scope:** status enum; closure event-log / stats counter (FR-012); A3-vs-A4 intent
split in storage; library search (FR-010); soft-delete; new RLS policies.

## Architecture / Approach

One `useLinks` realtime subscription keeps a single flat `Link[]`; the two views are
derived by filtering on `in_library` at render. INSERT prepends to inbox, UPDATE replaces
in place (so an A2 move re-buckets automatically), DELETE removes everywhere. A
`useLinkActions` hook owns optimistic updates and the inbox deferred-delete-with-undo
timers. The endpoint conforms to api-conventions (200 PATCH / 204 DELETE / 404-not-403).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend Foundation | `note` migration, types, `UpdateLinkSchema`, `/api/links/[id]` PATCH+DELETE | 404-not-403 via affected-row count must be correct |
| 2. Client State & Plumbing | realtime DELETE, optimistic mutation hook + undo, dashboard split | deferred-delete timer lifecycle (unmount, collisions) |
| 3. Inbox Closure UI | inline A2–A5 actions, visit + reminder, undo toast, shared edit modal | toast/optimistic vs realtime double-removal |
| 4. Library View | filtered list, confirm-gated single delete, edit reuse, roadmap note | none significant (mechanical) |

**Prerequisites:** local Supabase running for the migration + type regen; bot/link flow
working to seed inbox rows for manual testing.
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- Adding shadcn Dialog/Sonner/AlertDialog pulls new radix/sonner deps (lockfile churn).
- Client-side `last_visited` is server-authored (`now()` on `visited:true`) to stay
  trustworthy.
- Deferred-delete must fire on unmount rather than being dropped, or a closed link could
  silently survive.

## Success Criteria (Summary)

- A link can be kept (→ library), consumed-closed, discarded (with undo), edited, and
  removed-from-library, each reflecting instantly and across tabs.
- Hard-deletes actually remove the row; ownership errors return 404, never 403.
- Library rows are separated from the inbox and show their persisted note.
