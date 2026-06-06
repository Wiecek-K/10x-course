# Pin Playwright MCP Artifact Output — Implementation Plan

## Overview

Playwright MCP screenshots land in the repo root (e.g. `verify-signin.png`,
`verify-signin-8788.png`) and show up as untracked files in `git status`. We make the
intended artifact location (`playwright-artifacts/`) actually enforced through two
committable, team-portable controls — an **agent convention in `CLAUDE.md`** and
**`.gitignore` entries** (the artifact dir + a targeted safety net for stray root
screenshots) — plus an **optional, documented user-local hardening** for anyone who
wants the MCP server to pin `--output-dir` on their own machine.

## Current State Analysis

- **The Playwright MCP server is plugin-provided, not repo-provided.** Its definition
  lives in `~/.claude/plugins/cache/claude-plugins-official/playwright/*/.mcp.json`:
  `{ "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"] } }`. This is
  in the user's home, regenerated from the plugin marketplace on update — **not
  committable** and not portable across teammates.
- **A project `.mcp.json` would NOT override the plugin server — it would add a parallel
  one.** Agents call tools namespaced `mcp__plugin_playwright_playwright__*` (see
  `.claude/settings.local.json:21-31`). A project `.mcp.json` server named `playwright` surfaces
  as `mcp__playwright__*` — a different server nobody calls. So pinning `--output-dir` on
  the server agents actually use is **not achievable from the repo** without disabling the
  plugin and rewiring every agent reference + the allowlist (a large, brittle change we
  are explicitly not doing).
- **`.gitignore` on `main` has only `.playwright-mcp/`** (line 50) — there is **no**
  `playwright-artifacts/` entry. (The original `change.md` assumed it existed; it exists
  only on the `bot-capture-to-inbox` branch, not `main`, which this change branches from.)
- **`CLAUDE.md` on `main` has no Playwright section** (it has a `10xDevs … E2E Tests`
  block inside the 10x-cli managed region, but no artifact/screenshot convention). The
  `## Playwright testing` section exists only on `bot-capture-to-inbox`.
- **The mechanism that fails (verified — see `research.md`):** when an agent supplies
  `filename`, `browser_take_screenshot` resolves it via `workspaceFile()` against the MCP
  server's cwd = repo root (no `--output-dir` involved, and no `mkdir`). A **bare** name
  therefore lands in the repo root, bypassing `.gitignore` (which only catches files
  written _into_ the ignored dirs, not files written to cwd). A name **with the
  `playwright-artifacts/` prefix** (absolute or relative) resolves correctly _if the dir
  exists_; a name **omitted entirely** auto-saves via `outputFile()` into the default
  `outputDir` = `.playwright-mcp/` (already gitignored).

## Desired End State

A screenshot taken via the Playwright MCP, following the documented convention, lands
under `playwright-artifacts/` (gitignored), and `git status` stays clean after a
Playwright session. Even if an agent slips and passes a bare filename, the targeted
`.gitignore` safety net keeps the stray root screenshot out of `git status`. Verify by
running a live Playwright screenshot via a subagent and confirming the file location +
clean `git status`.

### Key Discoveries:

- Plugin server command: `~/.claude/plugins/cache/.../playwright/*/.mcp.json` — user-home,
  non-committable.
- Tool namespace proves project `.mcp.json` can't override it: `.claude/settings.local.json:21-31`
  lists `mcp__plugin_playwright_playwright__*`.
- `.gitignore:49-50` — only `.playwright-mcp/` is present today; `playwright-artifacts/`
  is missing on `main`.
- This Astro project keeps intended images under `public/` and `src/` — there are no
  tracked PNGs in the repo root, so a root-anchored screenshot safety net is safe.

## What We're NOT Doing

- **Not** disabling the plugin Playwright server or switching to a project-owned MCP
  server with `--output-dir`. That would break the `mcp__plugin_playwright_playwright__*`
  tool names, require rewriting the allowlist and every agent reference, and diverge from
  the 10x-cli plugin convention. Rejected as oversized for this fix.
- **Not** editing the plugin cache `.mcp.json` as the primary fix (user-local, overwritten
  on plugin update, non-portable). Only documented as optional hardening.
- **Not** adding a broad recursive `*.png` ignore. We use a root-anchored, targeted net to
  avoid silently swallowing intended project images.
- **Not** expanding into broader Playwright E2E test configuration — that is `/10x-e2e`
  territory, out of scope for TAB-15.

## Implementation Approach

Single phase. Land the two committable controls (convention + gitignore), document the
optional user-local hardening, then verify end-to-end with a live Playwright screenshot.
The convention is the primary fix (agents write to the right place); the gitignore safety
net is belt-and-suspenders for the slip case.

## Phase 1: Enforce artifact location + verify

### Overview

Add the `.gitignore` entries (artifact dir + targeted root safety net), add the agent
convention to `CLAUDE.md`, document the optional user-local `--output-dir` hardening in
`change.md`, then verify with a live Playwright screenshot and a clean `git status`.

### Changes Required:

#### 1. `.gitignore` — artifact dir (tracked placeholder) + targeted safety net

**File**: `.gitignore`, `playwright-artifacts/.gitkeep`

**Intent**: Make the intended artifact location ignored **but keep the directory itself on
disk after a fresh clone** (the screenshot write does not create it — see Rationale), and
add a targeted, root-anchored net so a stray screenshot written to the repo root
(bare-filename slip) never appears in `git status`. Targeted, not broad — root-anchored
image extensions only. This project has no tracked root-level images, so the net cannot
swallow intended assets.

**Contract**: Under the existing `# Playwright MCP session artifacts` block (near
`.gitignore:49-50`), ignore the artifact dir's contents while **tracking a placeholder**,
plus the root-anchored net:

```gitignore
# Playwright artifacts (agents write here; never the repo root)
playwright-artifacts/*
!playwright-artifacts/.gitkeep
# Safety net: stray root-level screenshots from a bare-filename slip
/*.png
/*.jpg
/*.jpeg
```

Then create an empty `playwright-artifacts/.gitkeep` and commit it (`git add
playwright-artifacts/.gitkeep` works thanks to the negation — no `-f` needed). Keep
`.playwright-mcp/` as-is.

**Rationale (verified — see `research.md`):** the screenshot tool resolves an
agent-supplied `filename` via `workspaceFile()` against the repo root and does **not**
`mkdir` (only the auto-named `outputFile()` path creates dirs). Because
`playwright-artifacts/` is gitignored and git does not track empty directories, without a
committed `.gitkeep` the dir is absent on a fresh clone and every convention-following
screenshot fails with `ENOENT` (reproduced in the live probe). The `playwright-artifacts/*`

- `!playwright-artifacts/.gitkeep` pair ignores the contents but tracks the placeholder so
  the directory always exists.

#### 2. `CLAUDE.md` — Playwright artifact convention for agents

**File**: `CLAUDE.md`

**Intent**: Establish the durable agent convention for `browser_take_screenshot` (and any
Playwright MCP tool that writes a file). The rule that actually matters (verified — see
`research.md`): the `filename` arg is resolved against the repo root, so **a bare filename
lands in the repo root** — that is the only failure mode. A `filename` that **includes the
`playwright-artifacts/` prefix** (absolute _or_ relative) lands correctly; **omitting
`filename`** auto-saves into the gitignored `.playwright-mcp/`. This is the "for agents"
half of TAB-15.

**Contract**: Add a concise Playwright-artifacts convention to `CLAUDE.md`. Since `main`'s
`CLAUDE.md` has no Playwright section, introduce a short self-contained subsection (e.g.
`## Playwright` or near the conventions list) stating: **never pass a bare filename**;
either pass a path **with the `playwright-artifacts/` prefix** (absolute or relative —
both resolve against the repo root) **or omit `filename`** to land in the gitignored
`.playwright-mcp/`; one-line rationale (bare name → repo-root cwd of the plugin server);
and a pointer that `playwright-artifacts/` is gitignored but kept via a committed
`.gitkeep`. Keep it self-contained to minimize merge conflict with the
`## Playwright testing` section that exists on `bot-capture-to-inbox`.

#### 3. `change.md` — correct the `--output-dir` framing

**File**: `context/changes/playwright-mcp-output-dir/change.md`

**Intent**: The original `change.md` proposed pinning `--output-dir` as the _primary_ fix.
Research (`research.md`) shows that is the **wrong lever** for this bug: `--output-dir`
(and `PLAYWRIGHT_MCP_OUTPUT_DIR`) only governs the **auto-named** path
(`outputFile → outputDir`, default `.playwright-mcp/`, already gitignored). A **bare
filename** — the actual root-pollution case — routes through `workspaceFile → cwd`
(repo root) and is completely unaffected by `--output-dir`. So it is neither committable
nor effective for this bug. Replace the misleading "pin `--output-dir`" framing.

**Contract**: Update `change.md` Notes so the recorded fix matches reality: the real,
committable enforcement is the **convention** + the **`.gitignore` net** + the **committed
`playwright-artifacts/.gitkeep`**. If `--output-dir` is mentioned at all, flag it
explicitly as affecting only auto-named artifacts (already gitignored) and **not** the
bare-filename root case — not a hard enforcement opt-in. Also correct the earlier
assumption that `.gitignore`/`CLAUDE.md` already carried the entries on `main`.

### Success Criteria:

#### Automated Verification:

- [ ] `.gitignore` ignores artifact contents: `grep -q '^playwright-artifacts/\*' .gitignore`
- [ ] Targeted root net present (png+jpeg): `grep -q '^/\*\.png' .gitignore && grep -qE '^/\*\.jpe?g' .gitignore`
- [ ] Safety net catches a stray root screenshot: `git check-ignore -q some-stray.png` returns 0 (after the entry is added)
- [ ] Placeholder tracked & dir survives clone: `git ls-files --error-unmatch playwright-artifacts/.gitkeep` returns 0 **and** `git check-ignore -q playwright-artifacts/.gitkeep` returns non-zero (not ignored)
- [ ] `CLAUDE.md` mentions the convention: `grep -qi 'playwright-artifacts' CLAUDE.md`
- [ ] Lint/format clean on changed docs: `bun run format` leaves no diff on `.gitignore`/`CLAUDE.md`/`change.md`

#### Manual Verification:

- [ ] A subagent runs a live Playwright screenshot following the new convention (absolute path under `playwright-artifacts/`) and the file lands there
- [ ] `git status` is clean (no untracked PNG in repo root) after the Playwright session
- [ ] The `CLAUDE.md` convention reads clearly to an agent who wasn't part of this change

**Implementation Note**: After automated verification passes, pause for human
confirmation that the live Playwright test landed the screenshot under
`playwright-artifacts/` and `git status` stayed clean before considering the phase done.

---

## Testing Strategy

### Manual Testing Steps:

1. Dispatch a `general-purpose` subagent (per `CLAUDE.md` Playwright rule) to navigate to
   any page and call `browser_take_screenshot` with an absolute path under
   `<repo>/playwright-artifacts/`.
2. Confirm the screenshot exists under `playwright-artifacts/` and `git status` shows no
   new untracked file in the repo root.
3. (Safety-net check) `touch stray.png` at repo root, run `git check-ignore -q stray.png`
   → expect exit 0; remove it.

## Migration Notes

The two leftover root PNGs from the original debug session were already cleaned up
(observations S381/997). No data migration needed.

## References

- Linear: TAB-15 — `krystiandwiecek/tab-15-pin-playwright-mcp-artifact-output-to-gitignored-dir-stop`
- Change identity: `context/changes/playwright-mcp-output-dir/change.md`
- Plugin server def: `~/.claude/plugins/cache/claude-plugins-official/playwright/*/.mcp.json`
- Tool namespace evidence: `.claude/settings.local.json:21-31`
- Current ignore block: `.gitignore:49-50`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Enforce artifact location + verify

#### Automated

- [x] 1.1 `.gitignore` ignores `playwright-artifacts/*` contents
- [x] 1.2 Targeted root net present (`/*.png`, `/*.jpg`, `/*.jpeg`)
- [x] 1.3 Safety net catches a stray root screenshot (`git check-ignore`)
- [x] 1.4 `playwright-artifacts/.gitkeep` tracked & dir survives clone
- [x] 1.5 `CLAUDE.md` mentions the `playwright-artifacts` convention
- [x] 1.6 Format clean on changed docs

#### Manual

- [x] 1.7 Live Playwright screenshot lands under `playwright-artifacts/`
- [x] 1.8 `git status` clean after the Playwright session
- [x] 1.9 `CLAUDE.md` convention reads clearly to a fresh agent
