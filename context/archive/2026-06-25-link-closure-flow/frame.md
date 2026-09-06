# Frame Brief: Link Closure Flow (S-04)

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

S-04 `link-closure-flow` (roadmap.md:152). User browses the inbox (chronological
list), clicks a link to open it (visit recorded + `last_visited` timestamp; state
does **not** change), and consciously closes a link in one of three modes — "consumed —
keep in library" / "consumed — close" / "discard" — each with an optional note.
Per-link manual edit of `micro_description` and `url` is also available.

No inline framing was supplied by the user; the observation is taken verbatim from
roadmap S-04 / PRD FR-008. This is an observation-driven (scope/design) frame, not a
bug frame.

## Initial Framing (preserved)

- **User's stated cause or approach**: none given — roadmap calls this a "4-state
  lifecycle" (roadmap.md:154, :161).
- **User's proposed direction**: none given — framing requested before planning.
- **Pre-dispatch narrowing**: user resolved all three scope/position questions inline
  (no sub-agent dispatch needed — source material was small enough to read directly):
  - **Event scope** → "FR-008 UX only, defer the closure event-log."
  - **State model** → "2 live states + 2 events" (keep `in_library boolean`).
  - **Delete kind** → "hard-delete" (follows from the state-model choice).
  - Consciously accepted cost: the consumed/discarded statistic is **not** tracked
    retroactively — it accrues only once FR-012 is implemented.

## State & Action Model (vocabulary — locked in discussion)

Naming trap: **"closure" (zamknięcie)** = the umbrella ritual of consciously ending a
link's inbox life via one of 3 modes. **"close" (zamknij)** = one specific mode
("pochłonięte — zamknij"). They are not the same word; the brief uses full names.

**States** (persisted — what a link *is*). Only two exist as a row:

| State | PRD name | Schema | Meaning |
| --- | --- | --- | --- |
| inbox | "na później" | `in_library = false` (default) | new link lands here; the "later" list |
| library | "w bibliotece" | `in_library = true` | referential, kept, searchable |

After two of the three closure modes there is **no row** — these are not states:
consumed-closed ("pochłonięte — zamknij") and discarded ("odrzuć") both DELETE the row.

**Actions** (verbs — what the user *does*):

| # | Action | PRD mode | From | DB effect | Changes state? |
| --- | --- | --- | --- | --- | --- |
| A1 | open / visit | — | inbox or library | `last_visited = now()` + visited marker | **NO** |
| A2 | keep-in-library | "pochłonięte — zachowaj w bibliotece" | inbox → library | `UPDATE in_library=true` | yes |
| A3 | consume-close | "pochłonięte — zamknij" | inbox/library | `DELETE` | yes (row gone) |
| A4 | discard | "odrzuć" | inbox/library | `DELETE` | yes (row gone) |
| A5 | edit | — | any live state | `UPDATE url, micro_description` | no |

The three "closure modes" of FR-008 = A2 + A3 + A4. A3 vs A4 are **identical in the DB**
(both DELETE); the only difference is intent → a stats counter, which is the deferred
event-log. In MVP they are technically indistinguishable apart from the UI label.

## Discussion Resolutions (post-frame, user-confirmed)

1. **Visited-awaiting-action reminder** — IN SCOPE. A link in inbox with
   `last_visited IS NOT NULL` renders a visual reminder ("opened, awaiting your manual
   move"). No auto state transition — the reminder nudges, it does not act. No new
   column: `last_visited != null` is the source of truth.
2. **A3 and A4 are two separate buttons now** — even though the backend is one `DELETE`,
   the UI ships both "consume-close" and "discard" so the MVP demo reflects the intended
   direction. The intent split (counter) lands later with the event-log.
3. **No closure-note for A3/A4** — dropped. At the inbox stage the only "note" present is
   the generated `micro_description` (a read-it teaser), not a learning note; it is
   deleted together with the row. So FR-008's "optional note" does not apply to
   consume-close / discard in this slice.
4. **Editable note for A2 keep-in-library — IN SCOPE.** Adds a nullable `note text`
   column to `links`. Set optionally at keep-in-library, and editable thereafter via the
   A5 edit path (PATCH covers `url`, `micro_description`, `note`). Only meaningful for
   library rows (row survives); inbox/A3/A4 unaffected.

## Dimension Map

The design weight of this slice could sit at any of these dimensions:

1. **Live-state model** — inbox↔library. Already `in_library boolean` (migration
   `20260529120000_create_links.sql:16`). Roadmap framing ("4-state lifecycle") lands
   here and is partially misleading. ← initial framing
2. **Closure-event log** — close/discard delete the row + "event odnotowany w
   statystykach" (PRD FR-008). F-01 deferred the lifecycle event log to S-04
   (roadmap.md:82); PRD:123 says events must exist in the data model from day 1 so the
   FR-012 dashboard needs no retroactive migration. S-04 outcome text omits it. ←
   strongest tension
3. **Delete semantics** — hard-delete ("link usuwany z bazy", PRD FR-008) vs
   soft-delete. Coupled to dimension 1: an enum status ⟹ soft-delete; boolean + 2
   events ⟹ hard-delete.
4. **Visit tracking** — `last_visited timestamptz` exists; click sets timestamp +
   visited marker, never changes state. Mechanical.
5. **Single-resource API + manual edit** — no `src/pages/api/links/[id].ts` yet; needs
   PATCH/DELETE. Must return `404` (not `403`) for not-yours/not-found per the locked
   lesson. Mechanical.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| D1: "4-state lifecycle" is the right model | Schema already uses `in_library boolean`, not a 4-value enum (`create_links.sql:16-18`). PRD revision (prd:118a) states close & discard are *identical in storage* — both permanent deletion — differing only by a stats counter. So only 2 states are ever persisted. | **WEAK** (roadmap label overstates it) |
| D2: closure event-log belongs in this slice | F-01 explicitly defers "lifecycle event log" to S-04/S-06 (roadmap:82); PRD:123 requires day-1 events for FR-012-without-retroactive-migration. But S-04 outcome omits it, FR-012 has **no roadmap slice at all**, and user chose to defer. | **STRONG** as a latent gap; **deferred by decision** |
| D3: hard-delete is correct | PRD FR-008 literal: "link usuwany z bazy" for both close & discard. Matches the boolean state model (consumed/discarded are not persisted states). | **STRONG** |
| D4: visit tracking is non-trivial | `last_visited` column already present (`create_links.sql:19`); requirement is a bare timestamp write + visual marker, state unchanged (prd:118c). | **NONE** (mechanical) |
| D5: single-resource API missing | Only `src/pages/api/links/index.ts` exists (list + create). No `[id].ts`. PATCH/DELETE must be built; 404-not-403 rule applies. | **STRONG** (real work, but mechanical) |

## Narrowing Signals

Decisive observations that narrowed the space (all user-confirmed inline):

- The implemented schema (`in_library boolean`) already encodes the only two persisted
  states — the "4-state lifecycle" label conflates 2 states with 2 terminal actions.
- Q2/Q3 are **one decision**, not two: state-model choice dictates delete semantics
  (enum ⟹ soft-delete; boolean+events ⟹ hard-delete). User picked boolean+events ⟹
  hard-delete.
- FR-012 (dashboard) has no roadmap slice; the closure event-log it depends on is
  unscheduled. User accepted that closure statistics start from FR-012's future
  implementation, not retroactively.

## Cross-System Convention

Single-resource mutations on RLS tables already have a locked convention in this
project (lessons.md): `404` for not-yours/not-found (never `403`), zod-validated input,
`200` on update / `204` on delete. The new `links/[id].ts` PATCH/DELETE must conform.
Hard-delete via the cookie client works here because the owner mutates their own row
under the existing `links_delete_authenticated` / `links_update_authenticated` policies
— no service-role path needed (this is a session-bearing UI action, unlike S-01/S-02).

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: build the *closure UX + the two live-state
> transitions and two terminal deletions* over the existing `in_library boolean` model
> — NOT a 4-state status enum, and NOT (yet) a closure event-log.

The roadmap's "4-state lifecycle" label is the one piece of framing that needed
correcting: only two states are ever persisted (`inbox` / `library` via `in_library`);
"consumed-close" and "discard" are terminal *events* that hard-delete the row. The
single genuinely deferred concern — the closure event-log that PRD:123 wanted from day
1 — is consciously pushed to whenever FR-012 lands, with the accepted cost that
consumed/discarded statistics are not retroactive. Everything else (visit timestamp,
manual edit, single-resource API) is mechanical and conventional.

## Confidence

**HIGH** — evidence is direct (schema, PRD revision note, existing API surface), it
matches the project's locked single-resource convention, and the user resolved every
narrowing question inline. The one reframe (state-model label) is backed by the
implemented schema; the one deferral (event-log) is an explicit user decision with a
named accepted cost.

## What Changes for /10x-plan

Plan S-04 as (see State & Action Model + Discussion Resolutions above for locked
vocabulary and decisions):

- **Migration**: add nullable `note text` to `links` (for A2). No status enum, no
  event-log table.
- **A2 keep-in-library**: `UPDATE in_library=true` (+ optional `note`).
- **A3 consume-close** + **A4 discard**: both `DELETE` the row. Two distinct UI buttons,
  one shared backend delete. No counter, no event-log this slice.
- **A1 open/visit**: `UPDATE last_visited=now()`; inbox rows with `last_visited != null`
  show a "visited — awaiting action" reminder (no auto-transition).
- **A5 edit**: `links/[id].ts` PATCH for `url` + `micro_description` + `note`.
- **DELETE** also on `links/[id].ts`; both PATCH and DELETE conform to the
  `404`-not-`403` lesson (cookie client, owner mutates own row under existing RLS
  policies — no service-role path).
- **Note**: only A2 keep-in-library has a persisted, editable note (`note` column);
  A3/A4 carry no note (row + `micro_description` deleted).

**Do not** build a status enum or a closure event-log. Recommend the plan append a
roadmap note creating an explicit future slice (e.g. `S-07 closure-stats-dashboard`,
FR-012) that carries the event-log + the A3/A4 intent counter, so the "statistics start
from zero at that point" decision is recorded rather than lost.

## References

- Source files: `supabase/migrations/20260529120000_create_links.sql:11-54`,
  `src/types.ts:20-26`, `src/pages/api/links/index.ts`, `src/lib/schemas/links.ts`,
  `src/components/InboxList.tsx`
- PRD: `context/foundation/prd.md` FR-008 (:117-118), FR-012 (:122-123), FR-010 (:132),
  Business Logic "Reguła zamknięcia" (:168-169)
- Roadmap: `context/foundation/roadmap.md` S-04 (:152-162), F-01 deferral (:82)
- Lessons: `context/foundation/lessons.md` — "Cross-user access must return an explicit
  error" (404-not-403)
- Investigation: inline (no sub-agent dispatch — source surface small enough to read
  directly)
