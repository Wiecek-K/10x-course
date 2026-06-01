# Linear — Task Management System

> Operational view of `context/foundation/roadmap.md` in Linear.
> Parallel system to `github-tasks.md` — both track the same 8 roadmap items; Linear is the primary day-to-day task management UI.

## System overview

| Property | Value |
|---|---|
| Workspace | tabnone |
| Team | Tabnone (`ea84fec4-8e40-40c4-91d4-33213f855db5`) |
| Project | `tabzero` (`6baa892b-654a-4554-897d-e49ac5505efa`) |
| Project URL | https://linear.app/tabnone/project/tabzero-bfba35fd283a |
| Issue identifiers | TAB-5 through TAB-12 (TAB-1–TAB-4 are pre-existing workspace issues) |
| Milestones | MVP Core (`c93bda7a`), MVP Extended (`82d7fc60`) |
| Source of truth | `roadmap.md` for design decisions; this file for Linear-specific IDs and conventions |

## Labels

8 custom labels created on team `Tabnone`. IDs listed for programmatic use via MCP.

### Type labels

| Label | Color | Linear ID | Applies to |
|---|---|---|---|
| `foundation` | `#6f42c1` purple | `2a84c9fd` | F-0x — infrastructure work |
| `slice` | `#0075ca` blue | `3e7c087b` | S-0x — user-facing feature slices |

### Stream labels

| Label | Color | Linear ID | Chain |
|---|---|---|---|
| `stream:A` | `#0e8a16` green | `1b78c1eb` | Wedge proof — F-01 → S-01 → S-02 |
| `stream:B` | `#1d76db` teal | `4117128f` | Async backbone — F-02 |
| `stream:C` | `#fbca04` yellow | `64a21858` | Library interaction — S-04 |
| `stream:D` | `#e4e669` lime | `316ba248` | Retrieval and structure — S-03 / S-06 |
| `stream:E` | `#d93f0b` red | `d371f0c5` | Extension surface — S-05 |

### Special label

| Label | Color | Linear ID | Meaning |
|---|---|---|---|
| `north-star` | `#ffd33d` gold | `c200f2b7` | North star slice — applied to TAB-8 (S-02) only |

## Status mapping

Linear statuses map to the `status:ready` / `status:proposed` GitHub label convention.

| Roadmap status | Linear status | Linear status type |
|---|---|---|
| `status:ready` | **Todo** | `unstarted` |
| `status:proposed` | **Backlog** | `backlog` |
| In progress | **In Progress** | `started` |
| In review | **In Review** | `started` |
| Merged / done | **Done** | `completed` |
| Dropped | **Canceled** | `canceled` |

## Milestones

| Milestone | Linear ID | Items | Purpose |
|---|---|---|---|
| **MVP Core** | `c93bda7a-2ad7-42e4-9862-12b888745dd7` | TAB-5, TAB-6, TAB-7, TAB-8 | North star chain — proves the wedge hypothesis |
| **MVP Extended** | `82d7fc60-e0d4-4460-ad46-c880b93f6ed7` | TAB-9, TAB-10, TAB-11, TAB-12 | Post-north-star expansion |

## Issue registry

All 8 active issues with Linear identifiers, `blockedBy` relations wired natively.

| Linear | GH# | Roadmap ID | Change ID | Title | Stream | Status | Milestone | Blocked by |
|---|---|---|---|---|---|---|---|---|
| TAB-5 | #2 | F-01 | `domain-data-foundation` | Links schema + RLS + minimal SSR API | A | Done | MVP Core | — |
| TAB-6 | #3 | F-02 | `link-processing-queue` | Cloudflare Queue plumbing scaffold | B | Todo | MVP Core | — |
| TAB-7 | #4 | S-01 | `bot-capture-to-inbox` | Bot capture to inbox | A | Todo | MVP Core | TAB-5 |
| TAB-8 | #5 | S-02 | `auto-description-pipeline` | Auto-description pipeline ⭐ | A | Backlog | MVP Core | TAB-5, TAB-6, TAB-7 |
| TAB-9 | #6 | S-04 | `link-closure-flow` | Closure flow + per-link manual edit | C | Backlog | MVP Extended | TAB-5, TAB-7 |
| TAB-10 | #7 | S-03 | `nl-search-on-links` | NL search on saved links | D | Backlog | MVP Extended | TAB-5, TAB-8 |
| TAB-11 | #8 | S-06 | `category-proposal-and-routing` | Category proposal, meta-instructions + routing | D | Backlog | MVP Extended | TAB-5, TAB-6, TAB-8 |
| TAB-12 | #9 | S-05 | `extension-capture` | Browser extension capture | E | Todo | MVP Extended | TAB-5 |

⭐ = north-star slice

## Issue body template

Every issue follows the same 7-section structure as `github-tasks.md`:

```markdown
## Outcome
<single paragraph — what the user can do when this is done>

## Change ID
`<change-id>` — run `/10x-plan <change-id>`

## PRD refs
- FR-XXX / NFR "..." / US-XX

## Prerequisites
- TAB-N — [ID] short title

## Parallel with
- TAB-N — [ID] short title

## Risk
<risk paragraph from roadmap>

## Unknowns
- <item> — Owner: TBD / user. Block: no.
- (none)
```

All content in **English** per `CLAUDE.md` convention.

## Maintenance rules

### When a blocked issue becomes unblocked

When a `blockedBy` issue moves to Done, Linear automatically surfaces the dependent issue. Additionally update its status from Backlog → Todo:

```
MCP: save_issue(id: "TAB-N", state: "Todo")
```

### When starting implementation

Move to **In Progress** and link the branch/PR in a comment:

```
MCP: save_issue(id: "TAB-N", state: "In Progress")
MCP: save_issue(id: "TAB-N", links: [{url: "<PR URL>", title: "PR: <title>"}])
```

### When implementation is merged

Move to **Done**:

```
MCP: save_issue(id: "TAB-N", state: "Done")
```

Then check which issues had TAB-N in `blockedBy` and move them to Todo if now unblocked.

### When adding a new roadmap item

1. Create the issue via MCP `save_issue` with team `Tabnone`, project `tabzero`.
2. Assign the correct milestone (`MVP Core` or `MVP Extended`).
3. Wire `blockedBy` with the TAB-N identifiers of prerequisites.
4. Add this issue to the registry table in this file.
5. Mirror the issue in `github-tasks.md` (run `gh issue create` and update its registry too).

### Labels are mutually exclusive per group

- Exactly one type label per issue: `foundation` or `slice`.
- Exactly one stream label per issue: `stream:A` through `stream:E`.
- `north-star` is additive — only on TAB-8.

## Linear MCP quick reference

```python
# List all issues in the project
list_issues(project="tabzero")

# View a specific issue
get_issue(id="TAB-5")

# Update status
save_issue(id="TAB-5", state="In Progress")

# Add a PR link
save_issue(id="TAB-5", links=[{"url": "https://github.com/...", "title": "PR: ..."}])

# Add a label
save_issue(id="TAB-5", labels=["foundation", "stream:A"])

# List issues blocked by a specific issue
list_issues(project="tabzero", query="TAB-5")

# Check milestone progress
get_milestone(id="c93bda7a-2ad7-42e4-9862-12b888745dd7")
```

## Relationship to other context files

| File | Relationship |
|---|---|
| `context/foundation/roadmap.md` | Canonical source — design decisions, risk, unknowns |
| `context/foundation/linear-tasks.md` | This file — Linear IDs, statuses, MCP conventions |
| `context/foundation/github-tasks.md` | Mirror system — GitHub Issues #N identifiers and gh CLI conventions |
| `context/foundation/lessons.md` | Recurring implementation rules (not project management) |
| `context/changes/<change-id>/plan.md` | Per-issue implementation plan created by `/10x-plan` |

When an agent uses the Linear MCP to manage work, read this file. When an agent uses `gh` CLI, read `github-tasks.md`.

**No synchronization is in place.** Both systems were seeded from the same roadmap snapshot but are independently maintained from this point forward. Status changes in one system are not reflected in the other unless done manually.
