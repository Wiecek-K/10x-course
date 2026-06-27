# Link Closure Flow (S-04) Implementation Plan

## Overview

Build the closure UX and the two live-state transitions plus two terminal deletions over
the existing `in_library boolean` model. Add a single-resource API (`/api/links/[id]`)
with PATCH + DELETE, an editable `note` column for kept library rows, optimistic client
state with a deferred-delete undo flow for the inbox, and a split inbox / library view.
No status enum, no closure event-log (consciously deferred to a future FR-012 slice).

This plan is framed by `frame.md`, which is authoritative for the data model and action
vocabulary. The frame settled WHAT to build; this plan settles the solution/UI design.

## Current State Analysis

- **Schema** (`supabase/migrations/20260529120000_create_links.sql`): `links` has
  `in_library boolean NOT NULL DEFAULT false`, `last_visited timestamptz`, plus granular
  RLS policies (`links_update_authenticated`, `links_delete_authenticated`) scoped to
  `auth.uid() = user_id`. No `note` column.
- **API** (`src/pages/api/links/index.ts`): only `POST` (create, 201) + `GET` (list,
  200, `{ links }`). No `src/pages/api/links/[id].ts` — PATCH/DELETE do not exist.
- **Schemas** (`src/lib/schemas/links.ts`): `CreateLinkSchema`, `ListLinksQuerySchema`.
  No update schema.
- **Types** (`src/types.ts`): `Link` derives from `Database[...]["links"]["Row"]` with a
  narrowed `processing_status` union. `note` will appear automatically after type regen.
- **Realtime hook** (`src/components/hooks/useLinks.ts`): subscribes to INSERT + UPDATE
  for `user_id=eq.<id>`. **Does NOT handle DELETE** — a hard-deleted row never leaves the
  client list via realtime. Returns one flat `Link[]`.
- **Inbox UI** (`src/components/InboxList.tsx`): renders rows with URL, micro_description,
  relative time, and a processing-status badge. **Zero action controls.**
- **Dashboard** (`src/pages/dashboard.astro`): loads **all** links unfiltered
  (`.select("*")`, line 18) and passes them to a single `InboxList`. No library view, no
  `in_library` filter — library rows currently render inside the inbox.
- **shadcn/ui** (`src/components/ui/`): only `button.tsx`. No Dialog, AlertDialog, or
  toast/Sonner yet. Only `@radix-ui/react-slot` is installed.
- **Tests**: unit tests cover pure functions and zod schemas
  (`src/lib/schemas/links.test.ts`). No API endpoint integration tests exist.
- **API convention** (`context/foundation/api-conventions.md`): single-resource
  mutations return `404` (never `403`) for not-yours/not-found; `200` on PATCH (return
  row), `204` on DELETE (empty body); zod-validated input; check `locals.user` first.

### Key Discoveries:

- `useLinks.ts:34-40` handles UPDATE but not DELETE — A3/A4 will not auto-remove the row;
  the plan adds a DELETE realtime handler **and** optimistic local removal.
- `dashboard.astro:18` loads all links unfiltered — A2 (`in_library=true`) currently
  leaves the row visible in the inbox; the plan splits the view by `in_library`.
- The UPDATE realtime handler already updates a row in place
  (`useLinks.ts:36-39`), so flipping `in_library` propagates correctly **once the views
  filter client-side** — no extra subscription needed.
- 404-not-403 detection: after PATCH/DELETE, use the affected-row count
  (`count === 0` → 404), per `api-conventions.md:40-49`.

## Desired End State

A user on the dashboard sees two distinct sections: **Inbox** (`in_library=false`) and
**Library** (`in_library=true`). In the inbox each row offers inline actions — Keep in
library (A2), Consume-close (A3), Discard (A4), Edit (A5) — and opening the link (A1)
records a visit; an inbox row that was opened but not yet acted on shows a "visited —
awaiting action" reminder. A3/A4 remove the row optimistically and show an undo toast;
the actual hard-delete fires after the toast window unless undone. In the library each
row offers Edit (A5) and a single "Remove from library" action gated by a confirmation
dialog. Editing opens a shared modal (url, micro_description, note) that PATCHes the row.
All mutations reflect instantly (optimistic) and stay consistent across tabs (realtime
INSERT/UPDATE/DELETE).

Verify: send a link → appears in inbox; Keep → moves to library; Edit → fields persist;
open → reminder appears; Consume-close/Discard in inbox → row vanishes with undo option,
and DELETE fires after the window; Remove-from-library → confirm dialog → row gone; a
second browser tab reflects every change.

## What We're NOT Doing

- **No status enum** — the model stays `in_library boolean`.
- **No closure event-log / stats counter** — A3 vs A4 are indistinguishable in storage
  (both DELETE). The intent split and the consumed/discarded statistic are deferred to a
  future FR-012 `closure-stats-dashboard` slice (a roadmap note is added in Phase 4).
- **No closure note for A3/A4** — only A2 (kept library rows) has a persisted, editable
  `note`. Deleted rows carry no note.
- **No library search / FR-010** — the library is a simple filtered list this slice.
- **No soft-delete** — hard-delete only, per frame D3.
- **No new RLS policies** — existing update/delete policies already cover owner mutations
  via the cookie client.

## Implementation Approach

Bottom-up: land the backend (migration + endpoint) first so it is independently testable,
then the client state plumbing (realtime DELETE, optimistic mutation hook, dashboard
split), then the inbox closure UI (including the shared edit modal and undo toast), and
finally the library view. The edit modal is introduced in Phase 3 and reused in Phase 4.

State model: keep a single flat `Link[]` in the client (one `useLinks` subscription) and
derive the two views by filtering on `in_library` at render time. UPDATE realtime events
update the row in place, so an A2 move re-buckets it automatically; INSERT prepends to
inbox; DELETE removes it everywhere.

## Critical Implementation Details

- **Deferred-delete (inbox undo)** — A3/A4 in the inbox must NOT delete immediately. On
  click: optimistically remove the row from local state, show an undo toast, and schedule
  the real `DELETE /api/links/[id]` after the toast window (~5s). Undo cancels the timer
  and restores the row. The pending-delete timers must be cancellable and keyed by link
  id so two quick closes don't collide. If the component unmounts with a timer pending,
  fire the DELETE (do not silently drop it). Library removal does NOT use this path — it
  confirms via AlertDialog and deletes immediately.
- **Realtime DELETE ordering** — adding the DELETE handler means a row the local client
  already removed optimistically may also arrive as a realtime DELETE; removal must be
  idempotent (filter by id is naturally idempotent).
- **Visit timestamp authorship** — A1 sets `last_visited`. The PATCH handler sets it to
  `now()` server-side when the request signals a visit (`visited: true`), so the
  timestamp is never client-authored. The visit PATCH is fire-and-forget from the `<a>`
  click and must not block navigation.

## Phase 1: Backend Foundation

### Overview

Add the `note` column, regenerate types, define the update schema, and build
`/api/links/[id]` (PATCH + DELETE) conforming to the 404-not-403 convention.

### Changes Required:

#### 1. Migration — add `note` column

**File**: `supabase/migrations/20260625HHmmss_add_links_note.sql` (use a real
timestamp at write time)

**Intent**: Add a nullable free-text note for kept library rows (A2 / editable via A5).
Only meaningful for `in_library = true` rows; inbox/deleted rows leave it null.

**Contract**: `ALTER TABLE public.links ADD COLUMN note text;` — nullable, no default, no
CHECK. No RLS change (existing policies cover the column). Apply locally
(`bunx supabase migration up` or `db push`) before regenerating types.

#### 2. Regenerate database types

**File**: `src/db/database.types.ts` (prettier-ignored, generated)

**Intent**: Pick up the new `note` column so `Link` exposes it.

**Contract**: Run the project's type-gen command against the migrated DB. `note: string |
null` appears on the `links` Row/Insert/Update. `Link` in `src/types.ts` inherits it with
no manual edit.

#### 3. Update schema (zod)

**File**: `src/lib/schemas/links.ts`

**Intent**: Validate the PATCH body — a partial update over the mutable fields plus a
server-resolved visit flag.

**Contract**: Export `UpdateLinkSchema` covering optional `url` (http(s), reuse the
`CreateLinkSchema` URL refinement), optional nullable `micro_description`, optional
nullable `note`, optional `in_library` boolean, and optional `visited: true`. Reject an
empty object (require at least one field). Export `UpdateLinkInput` from `src/types.ts`.

#### 4. Single-resource endpoint

**File**: `src/pages/api/links/[id].ts` (new)

**Intent**: PATCH updates a link (A2 move, A5 edit, A1 visit); DELETE hard-deletes it
(A3/A4, library remove). Both owner-scoped, both conform to api-conventions.

**Contract**:
- `export const prerender = false`.
- Both handlers: check `context.locals.user` first → `401`; validate the `id` route param
  is a uuid via zod → `400` on failure.
- **PATCH**: parse body with `UpdateLinkSchema` (`400` on failure). Build the update
  object from provided fields; when `visited === true`, set `last_visited = now()`
  server-side (ignore any client timestamp) and do not expose `visited` as a column.
  `.update(...).eq("id", id).select()` and inspect the result: zero rows affected →
  `404` `{ error: "not_found" }`; success → `200` with the updated row. DB error → `500`.
- **DELETE**: `.delete().eq("id", id)` with a count/returning check: zero rows → `404`;
  success → `204` empty body. DB error → `500`.
- Use the cookie client (`createClient(request.headers, cookies)`); RLS scopes the row to
  the owner. Never return `403`. Cast the returned row `as Link`.

#### 5. Schema unit tests

**File**: `src/lib/schemas/links.test.ts`

**Intent**: Lock the `UpdateLinkSchema` contract (the endpoint itself has no integration
test harness — matches the existing test surface).

**Contract**: Cover: valid partial bodies (single field each), empty object rejected,
bad URL rejected, `note`/`micro_description` accept null, `visited` accepts only `true`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against local Supabase
- Type regen produces `note` on the links Row: `bun run build` typechecks
- Lint passes: `bun run lint`
- Unit tests pass: `bun run test`
- Format check passes: `bun run format:check`

#### Manual Verification:

- `PATCH /api/links/<own-id>` with `{ in_library: true }` returns 200 + updated row
- `PATCH /api/links/<own-id>` with `{ visited: true }` sets `last_visited` to ~now
- `PATCH`/`DELETE` on a non-existent or another user's id returns `404` (not 403)
- `DELETE /api/links/<own-id>` returns 204 and the row is gone
- Unauthenticated request returns `401`

**Implementation Note**: After completing this phase and all automated verification
passes, pause for manual confirmation before proceeding.

---

## Phase 2: Client State & Plumbing

### Overview

Make the client reflect deletes and moves: add a DELETE realtime handler, an optimistic
mutation hook with the deferred-delete (undo) mechanism, and split the dashboard into
inbox and library views over a single link source.

### Changes Required:

#### 1. Realtime DELETE handler

**File**: `src/components/hooks/useLinks.ts`

**Intent**: Remove a row from local state when a DELETE event arrives, so hard-deletes
propagate across tabs. Keep the existing INSERT (prepend) and UPDATE (replace) handlers.

**Contract**: Add a `postgres_changes` DELETE listener filtered by `user_id=eq.<id>`;
on event, drop the row whose id matches `payload.old.id`. Removal is idempotent.

#### 2. Mutation hook with optimistic + deferred-delete

**File**: `src/components/hooks/useLinkActions.ts` (new)

**Intent**: Centralize A2/A3/A4/A5/visit mutations with optimistic local updates, plus
the inbox deferred-delete-with-undo flow. The hook owns the local `Link[]` setter so
optimistic changes and server confirmation stay in one place.

**Contract**: Expose actions: `keepInLibrary(id)` (PATCH `{in_library:true}`, optimistic
flip), `editLink(id, fields)` (PATCH `{url?,micro_description?,note?}`, optimistic
merge), `markVisited(id)` (fire-and-forget PATCH `{visited:true}`), `removeImmediately(id)`
(DELETE now — library path), and `removeWithUndo(id)` (optimistic remove + schedule
DELETE after ~5s, returning an `undo()` that cancels the timer and restores the row).
Pending timers are keyed by id and cancellable; a pending timer fires on unmount rather
than being dropped. On PATCH/DELETE failure, roll back the optimistic change and surface
an error. This hook composes with `useLinks` (single source of truth for the list).

#### 3. Dashboard split into inbox + library

**File**: `src/pages/dashboard.astro` and the island wiring

**Intent**: Load all links once, render two filtered sections. Keep one realtime
subscription feeding both.

**Contract**: Server load stays `.select("*")` (all links). Introduce a single React
container island that holds `useLinks` + `useLinkActions` and renders an Inbox section
(rows where `in_library === false`) and a Library section (rows where `in_library ===
true`), each with an empty state. The existing `InboxList` becomes a child receiving its
filtered rows and the action callbacks (Phase 3); the Library list is added in Phase 4.
Pass `userId`, `supabaseUrl`, `supabaseAnonKey` to the container as today.

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `bun run build`
- Lint passes: `bun run lint`
- Existing tests still pass: `bun run test`
- Format check passes: `bun run format:check`

#### Manual Verification:

- Deleting a row in one tab removes it from a second open tab (realtime DELETE)
- Flipping `in_library` in one tab re-buckets the row in a second tab (realtime UPDATE)
- Dashboard renders separate Inbox and Library sections; library rows no longer appear in
  the inbox
- An optimistic action reflects instantly; a forced server error rolls it back

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 3: Inbox Closure UI

### Overview

Add inline actions to inbox rows (Keep, Consume-close, Discard, Edit), the visited
reminder, the visit-on-open behavior, the undo toast for inbox deletes, and the shared
edit modal.

### Changes Required:

#### 1. Add shadcn components

**File**: `src/components/ui/` (Dialog, Sonner/toast)

**Intent**: Provide the edit modal and the undo toast primitives.

**Contract**: `bunx shadcn@latest add dialog sonner` (new-york variant). Mount the Sonner
`<Toaster />` once near the dashboard island root. Pulls the corresponding radix/sonner
deps — commit the lockfile change.

#### 2. Inbox row actions

**File**: `src/components/InboxList.tsx`

**Intent**: Render inline buttons per row — Keep in library (A2), Consume-close (A3),
Discard (A4), Edit (A5). Opening the link (A1) is the existing `<a>`, extended to record a
visit. Show a "visited — awaiting action" reminder when `last_visited != null`.

**Contract**: Receive filtered inbox `Link[]` and action callbacks from the container.
- A2 button → `keepInLibrary(id)`.
- A3 ("Consume-close") and A4 ("Discard") buttons → both call `removeWithUndo(id)`, then
  show an undo toast (`toast(...)` with an "Undo" action calling the returned `undo()`).
  Two distinct labels, one shared delete path.
- A5 ("Edit") button → opens the shared edit modal for that row.
- A1: the row `<a>` `onClick` fires `markVisited(id)` (non-blocking; navigation proceeds).
- Reminder: when `link.last_visited` is non-null, render a subtle marker/text ("opened —
  awaiting action"). No auto-transition. Use `cn()` for classes.

#### 3. Shared edit modal

**File**: `src/components/EditLinkDialog.tsx` (new)

**Intent**: One modal editing `url`, `micro_description`, `note`, used by inbox and (Phase
4) library. PATCHes via `editLink`.

**Contract**: shadcn Dialog with three fields prefilled from the link; submit calls
`editLink(id, { url, micro_description, note })` (optimistic) and closes on success;
validation errors surface inline. Controlled open state lifted to the container so any row
can open it for its link.

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `bun run build`
- Lint passes: `bun run lint`
- Tests pass: `bun run test`
- Format check passes: `bun run format:check`

#### Manual Verification:

- Keep-in-library moves the row from Inbox to Library instantly
- Consume-close and Discard each remove the row and show an undo toast; Undo restores it;
  letting the toast expire performs the hard-delete (verify row gone in DB)
- Opening a link records the visit and the reminder appears on that inbox row
- Edit modal saves url/micro_description/note and the row updates
- No layout breakage with all four action buttons present (incl. mobile width)

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 4: Library View

### Overview

Render the library section with its own row actions (Edit, single Remove-from-library with
confirmation) reusing the shared edit modal, and record the deferred FR-012 work in the
roadmap.

### Changes Required:

#### 1. Add AlertDialog

**File**: `src/components/ui/` (AlertDialog)

**Intent**: Confirmation gate for the irreversible library delete.

**Contract**: `bunx shadcn@latest add alert-dialog`. Commit the lockfile change.

#### 2. Library list + actions

**File**: `src/components/LibraryList.tsx` (new)

**Intent**: Render library rows (`in_library === true`) with inline Edit (A5) and a single
"Remove from library" terminal action gated by a confirmation dialog.

**Contract**: Receive filtered library `Link[]` and callbacks from the container. Mirrors
`InboxList` row layout (URL, micro_description, note shown if present, relative time).
- "Edit" → opens the shared `EditLinkDialog`.
- "Remove from library" → opens an AlertDialog; on confirm calls `removeImmediately(id)`
  (DELETE now, no undo). No A2/A3/A4 split here — one delete, per the locked decision.
- Empty state when no library rows.

#### 3. Roadmap deferral note

**File**: `context/foundation/roadmap.md`

**Intent**: Record that the closure event-log + A3/A4 intent counter (FR-012) is a future
slice, so the "statistics start from zero at that point" decision is not lost.

**Contract**: Append a short note (near S-04 / the deferral at :82) naming a future
`closure-stats-dashboard` slice carrying the event-log and consumed/discarded counter.
Prose only; no schema or code.

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `bun run build`
- Lint passes: `bun run lint`
- Tests pass: `bun run test`
- Format check passes: `bun run format:check`

#### Manual Verification:

- Library section lists only `in_library=true` rows with note shown when present
- "Remove from library" opens a confirmation dialog; confirm hard-deletes the row; cancel
  leaves it
- Editing a library link (incl. its note) persists and reflects immediately
- Roadmap note for the future FR-012 slice is present and accurate

**Implementation Note**: Pause for manual confirmation; this is the final phase.

---

## Testing Strategy

### Unit Tests:

- `UpdateLinkSchema`: valid partial bodies, empty-object rejection, URL refinement, null
  for `note`/`micro_description`, `visited` only `true`.
- Any extracted pure helper (e.g. an inbox/library filter predicate) if introduced.

### Integration Tests:

- None automated (no endpoint harness exists). Endpoint behavior is covered by manual
  verification, matching the project's current test surface.

### Manual Testing Steps:

1. Send a link via the bot → it lands in Inbox.
2. Open it → reminder "opened — awaiting action" appears; `last_visited` set.
3. Keep in library → moves to Library section instantly.
4. Edit the library link's note → persists after reload.
5. Back in Inbox, Consume-close another link → undo toast → click Undo → row returns.
6. Consume-close again, let toast expire → row hard-deleted (confirm in DB).
7. Discard a link → same delete path, distinct label.
8. Remove a library link → confirm dialog → row gone.
9. Repeat 3–8 with a second browser tab open → every change propagates via realtime.

## Performance Considerations

Single realtime subscription feeds both views; filtering is in-render over a small
per-user list — no extra queries. Deferred-delete timers are few and short-lived.

## Migration Notes

One additive, nullable column (`note`) — no backfill, no data migration. Existing rows get
`note = null`. Reversible by dropping the column.

## References

- Frame brief: `context/changes/link-closure-flow/frame.md`
- API conventions: `context/foundation/api-conventions.md` (404-not-403, status maps)
- Schema: `supabase/migrations/20260529120000_create_links.sql:11-54`
- Existing endpoint pattern: `src/pages/api/links/index.ts`
- Realtime hook: `src/components/hooks/useLinks.ts`
- Inbox UI: `src/components/InboxList.tsx`
- Dashboard: `src/pages/dashboard.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.
> Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend Foundation

#### Automated

- [x] 1.1 Migration applies cleanly against local Supabase — 826f70d
- [x] 1.2 Type regen produces `note`; `bun run build` typechecks — 826f70d
- [x] 1.3 Lint passes: `bun run lint` — 826f70d
- [x] 1.4 Unit tests pass: `bun run test` — 826f70d
- [x] 1.5 Format check passes: `bun run format:check` — 826f70d

#### Manual

- [x] 1.6 PATCH `{in_library:true}` returns 200 + updated row — 826f70d
- [x] 1.7 PATCH `{visited:true}` sets `last_visited` to ~now — 826f70d
- [x] 1.8 PATCH/DELETE on non-existent or other-user id returns 404 (not 403) — 826f70d
- [x] 1.9 DELETE on own id returns 204 and row is gone — 826f70d
- [x] 1.10 Unauthenticated request returns 401 — 826f70d

### Phase 2: Client State & Plumbing

#### Automated

- [x] 2.1 Typecheck passes: `bun run build` — f59c339
- [x] 2.2 Lint passes: `bun run lint` — f59c339
- [x] 2.3 Existing tests still pass: `bun run test` — f59c339
- [x] 2.4 Format check passes: `bun run format:check` — f59c339

#### Manual

- [ ] 2.5 DELETE in one tab removes row in a second tab (realtime DELETE)
- [ ] 2.6 `in_library` flip re-buckets row in a second tab (realtime UPDATE)
- [ ] 2.7 Dashboard renders separate Inbox and Library sections; no library rows in inbox
- [ ] 2.8 Optimistic action reflects instantly; forced server error rolls back

### Phase 3: Inbox Closure UI

#### Automated

- [x] 3.1 Typecheck passes: `bun run build` — 1897cee
- [x] 3.2 Lint passes: `bun run lint` — 1897cee
- [x] 3.3 Tests pass: `bun run test` — 1897cee
- [x] 3.4 Format check passes: `bun run format:check` — 1897cee

#### Manual

- [x] 3.5 Keep-in-library moves row Inbox → Library instantly — 1897cee
- [x] 3.6 Consume-close / Discard remove row + undo toast; Undo restores; expiry hard-deletes — 1897cee
- [x] 3.7 Opening a link records visit and shows the reminder — 1897cee
- [x] 3.8 Edit modal saves url/micro_description/note — 1897cee
- [x] 3.9 No layout breakage with four action buttons (incl. mobile) — 1897cee

### Phase 4: Library View

#### Automated

- [x] 4.1 Typecheck passes: `bun run build` — 3cfb7fa
- [x] 4.2 Lint passes: `bun run lint` — 3cfb7fa
- [x] 4.3 Tests pass: `bun run test` — 3cfb7fa
- [x] 4.4 Format check passes: `bun run format:check` — 3cfb7fa

#### Manual

- [x] 4.5 Library lists only `in_library=true` rows with note shown when present — 3cfb7fa
- [x] 4.6 Remove-from-library confirm dialog hard-deletes on confirm; cancel leaves row — 3cfb7fa
- [x] 4.7 Editing a library link (incl. note) persists and reflects immediately — 3cfb7fa
- [x] 4.8 Roadmap note for future FR-012 slice present and accurate — 3cfb7fa
