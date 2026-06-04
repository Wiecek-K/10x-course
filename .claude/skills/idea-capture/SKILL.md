---
name: idea-capture
description: >
  Use when the user wants to file a product feature idea without stopping to
  discuss or implement it — they're parking a thought mid-task. Any phrasing
  where the user names a feature and defers it: "/idea", "quick idea", "future
  feature", "park this for later", "what if we added X", "random thought ...
  someday/not now/don't want to forget". The intent is pure capture: write the
  thought down and move on. Creates a structured markdown note in context/ideas/.
argument-hint: "<idea text>"
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
---

# idea-capture

Park a feature idea that's out of current scope but worth revisiting later.
The goal: two interactions max, then a structured file the user can read cold
in a month and immediately reconstruct the original thought.

## When invoked

Arguments: $ARGUMENTS

---

## Step 1 — Parse the idea

Use `$ARGUMENTS` as the idea text. If empty, say:

> What's the idea? (one sentence)

Wait for the user to reply, then continue.

---

## Step 2 — Auto-detect working context

Run these in parallel:

```bash
git branch --show-current
date +%Y-%m-%d
```

Then read `context/foundation/roadmap.md` if it exists.

Search the roadmap's **At a glance** table for a row whose `Change ID` column
matches the current branch name (exact string match). If found, extract:

- `ID` column → e.g. `S-01`
- `Change ID` column → e.g. `bot-capture-to-inbox`
- Format as: `S-01 · bot-capture-to-inbox`

If no match (branch is `main`, a worktree branch, or not in the table), set
detected context to `null`.

---

## Step 3 — Generate two value candidates

From the idea text alone, write **two short, distinct sentences** describing
what this feature would give the user. Think about them from different angles:

- Candidate A: the direct user outcome ("User can save X without needing Y")
- Candidate B: the indirect / broader angle ("Extends capture to scenarios
  where Z is unavailable")

These become the predefined options for the value question.

---

## Step 4 — Ask one AskUserQuestion with two questions

**Q1 — Value:**

> What value does this give the user?

Options: [candidate A] | [candidate B]
(Other → text field for anything that doesn't fit)

**Q2 — Trigger / context:**

> What triggered this idea?

Options:

- If a slice was detected: `[detected context]` | `"Unrelated to current work"`
- If no slice detected: `"General product thought"` | `"Inspired by current work"`

(Other → text field)

---

## Step 5 — Derive filename and write the file

Slugify the idea text:

- lowercase
- replace spaces and non-alphanumeric characters with hyphens
- collapse consecutive hyphens to one
- strip leading/trailing hyphens
- truncate at 50 chars on a word boundary

If `context/ideas/<slug>.md` already exists, append `-2`, `-3`, etc. until
the path is free. Create the `context/ideas/` directory if it doesn't exist.

Write `context/ideas/<slug>.md`:

```markdown
---
title: <idea text, sentence-cased>
date: <YYYY-MM-DD>
slice: <slice ID, e.g. "S-01", or null>
trigger: <Q2 answer>
status: raw
---

**Value:** <Q1 answer>
```

---

## Step 6 — Confirm

Print exactly one line:

```
✓ Captured → context/ideas/<slug>.md
```

No further commentary. The user is in the middle of something else.

---

## Edge cases

- **Roadmap file absent**: skip roadmap lookup, treat detected context as `null`.
- **Branch is a worktree branch** (e.g., `worktree-idea-capture-skill`): no match
  expected; treat as `null`.
- **Idea text is very long**: use only the first sentence for the title and slug;
  preserve the full text verbatim in the frontmatter `title` field.
- **File collision**: suffix `-2`, `-3` — never overwrite silently.
