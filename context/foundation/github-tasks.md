# GitHub Issues — Task Management System

> Operational view of `context/foundation/roadmap.md`.
> Canonical design lives in `roadmap.md`; this file documents the GitHub Issues structure, conventions, and maintenance rules so agents can navigate and update the backlog correctly.

## System overview

| Property | Value |
|---|---|
| Repository | `Wiecek-K/10x-course` |
| Tool | GitHub Issues + gh CLI |
| Active backlog | Issues #2–#9 (8 issues) |
| PR #1 | Test artifact — ignore |
| Source of truth | `roadmap.md` for design decisions; this file for issue numbers and operational conventions |

## Labels

10 custom labels are configured on the repo. All labels use the `--force` flag on creation so they are safe to re-run.

### Type labels (mutually exclusive)

| Label | Color | Applies to |
|---|---|---|
| `foundation` | `#6f42c1` purple | F-0x — infrastructure work with no direct user outcome |
| `slice` | `#0075ca` blue | S-0x — user-facing feature slices |

### Stream labels (each issue has exactly one)

Streams are dependency chains from `roadmap.md §Streams`. An issue belongs to the stream where it sits in the chain.

| Label | Color | Chain | Items |
|---|---|---|---|
| `stream:A` | `#0e8a16` green | Wedge proof | F-01, S-01, S-02 |
| `stream:B` | `#1d76db` teal | Async backbone | F-02 |
| `stream:C` | `#fbca04` yellow | Library interaction | S-04 |
| `stream:D` | `#e4e669` lime | Retrieval & structure | S-03, S-06 |
| `stream:E` | `#d93f0b` red | Extension surface | S-05 |

### Status labels (mutually exclusive — one per issue at all times)

| Label | Color | Meaning |
|---|---|---|
| `status:ready` | `#0e8a16` green | All prerequisites completed — ready for `/10x-plan` |
| `status:proposed` | `#cfd3d7` gray | Proposed — one or more prerequisites not yet done |

### Special label

| Label | Color | Meaning |
|---|---|---|
| `north-star` | `#ffd33d` gold | North star slice — the smallest end-to-end proof of the core hypothesis. Applied to S-02 only. |

## Milestones

| Milestone | GH number | Items | Purpose |
|---|---|---|---|
| **MVP Core** | 1 | #2, #3, #4, #5 | North star chain — proves the wedge hypothesis |
| **MVP Extended** | 2 | #6, #7, #8, #9 | Post-north-star expansion |

## Issue registry

All 8 active issues. Prerequisites link to `#N` GitHub issue numbers.

| GH# | Roadmap ID | Change ID | Title | Stream | Status | Milestone | Prerequisites |
|---|---|---|---|---|---|---|---|
| #2 | F-01 | `domain-data-foundation` | Links schema + RLS + minimal SSR API | A | ready | MVP Core | — |
| #3 | F-02 | `link-processing-queue` | Cloudflare Queue plumbing scaffold | B | ready | MVP Core | — |
| #4 | S-01 | `bot-capture-to-inbox` | Bot capture to inbox | A | proposed | MVP Core | #2 |
| #5 | S-02 | `auto-description-pipeline` | Auto-description pipeline ⭐ | A | proposed | MVP Core | #2, #3, #4 |
| #6 | S-04 | `link-closure-flow` | Closure flow + per-link manual edit | C | proposed | MVP Extended | #2, #4 |
| #7 | S-03 | `nl-search-on-links` | NL search on saved links | D | proposed | MVP Extended | #2, #5 |
| #8 | S-06 | `category-proposal-and-routing` | Category proposal, meta-instructions + routing | D | proposed | MVP Extended | #2, #3, #5 |
| #9 | S-05 | `extension-capture` | Browser extension capture | E | proposed | MVP Extended | #2 |

⭐ = north-star slice

## Issue body template

Every issue follows this 7-section structure:

```markdown
## Outcome
<single paragraph — what the user can do when this is done>

## Change ID
`<change-id>` — run `/10x-plan <change-id>`

## PRD refs
- FR-XXX / NFR "..." / US-XX

## Prerequisites
- #N — [ID] short title
- (none)

## Parallel with
- #N — [ID] short title

## Risk
<risk paragraph from roadmap>

## Unknowns
- <item> — Owner: TBD / user. Block: no.
- (none)
```

All content in **English** per `CLAUDE.md` convention.

## Maintenance rules

### When a prerequisite issue is closed (merged)

1. Identify issues that had it as a prerequisite (use the registry above).
2. Check if all their prerequisites are now closed.
3. If yes: switch `status:proposed` → `status:ready` on those issues.

```bash
gh issue edit <N> --repo Wiecek-K/10x-course \
  --remove-label "status:proposed" \
  --add-label "status:ready"
```

### When starting implementation of an issue

Add a comment on the issue linking the branch/PR:

```bash
gh issue comment <N> --repo Wiecek-K/10x-course \
  --body "Implementation started — branch: <branch-name>"
```

### When implementation is merged

Close the issue via the merge (preferred — use `Closes #N` in the PR body) or manually:

```bash
gh issue close <N> --repo Wiecek-K/10x-course
```

Then update dependent issues' status labels per the prerequisite rule above.

### When adding a new roadmap item

1. Determine the correct milestone (MVP Core if it's on the north-star critical path; MVP Extended otherwise).
2. Create the issue with `gh issue create` following the body template.
3. Add it to the issue registry in this file.
4. Update `## Parallel with` on any issues that can now run in parallel with it.
5. Update prerequisite cross-refs if any existing issues depend on it.

### Labels are the single source of status truth

- `status:ready` and `status:proposed` are always mutually exclusive.
- Never omit both — every issue must have one status label at all times.
- Do not use GitHub's built-in "open/closed" as a status proxy; use the labels.

### Do not close issues manually without a merged PR

Closing without a PR makes it impossible to trace what code delivered the outcome. Always link the implementing PR first.

## gh CLI quick reference

```bash
# List all open issues
gh issue list --repo Wiecek-K/10x-course --state open

# Filter by label
gh issue list --repo Wiecek-K/10x-course --label "status:ready"
gh issue list --repo Wiecek-K/10x-course --label "stream:A"

# View a specific issue
gh issue view <N> --repo Wiecek-K/10x-course

# Check milestone progress
gh api repos/Wiecek-K/10x-course/milestones

# Update labels
gh issue edit <N> --repo Wiecek-K/10x-course \
  --remove-label "status:proposed" \
  --add-label "status:ready"

# Close issue
gh issue close <N> --repo Wiecek-K/10x-course

# Add a comment
gh issue comment <N> --repo Wiecek-K/10x-course --body "..."
```

## Relationship to other context files

| File | Relationship |
|---|---|
| `context/foundation/roadmap.md` | Canonical source — design decisions, risk analysis, unknowns |
| `context/foundation/github-issues.md` | This file — operational view, issue numbers, maintenance rules |
| `context/foundation/lessons.md` | Recurring implementation rules and pitfalls (not project management) |
| `context/changes/<change-id>/plan.md` | Per-issue implementation plan created by `/10x-plan` |

When an agent needs to understand **why** something is sequenced a certain way, read `roadmap.md`. When it needs to know **which issue number** corresponds to a roadmap item or **how to update the backlog**, read this file.
