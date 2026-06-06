---
change_id: playwright-mcp-output-dir
title: Pin Playwright MCP artifact output to gitignored dir (stop root-level screenshots)
status: implementing
created: 2026-06-05
updated: 2026-06-06
archived_at: null
---

## Notes

Playwright MCP screenshots are landing in the repo root (e.g. `verify-signin.png`,
`verify-signin-8788.png`) and showing up as untracked files in `git status`.

**Root cause (chain):**

1. Playwright MCP is the official plugin `playwright@claude-plugins-official` (enabled
   in `~/.claude/settings.json`). It is plugin-managed — there is no `mcpServers` entry
   in `settings.json` and no project `.mcp.json` configuring it.
2. `browser_take_screenshot` takes a `filename` arg. When an agent passes a **bare
   relative filename** and the MCP server has **no `--output-dir`** set, the file is
   written relative to the MCP server process's working directory = the repo root.
3. `.gitignore` already declares `playwright-artifacts/` ("agents save here, never in
   project root") and `.playwright-mcp/`, but those only catch files written _into_ those
   dirs. A bare filename bypasses them and lands in cwd (root), which is not ignored.

**Gap:** the intended artifact location exists in `.gitignore` but nothing _enforces_
it — neither MCP server config (no pinned output-dir) nor an agent convention.

**Actual fix (after research confirmed `--output-dir` is the wrong lever):**

- `--output-dir` governs only **auto-named** artifacts (`outputFile → outputDir`, default
  `.playwright-mcp/`, already gitignored). It is **not** committable (lives in the
  user-home plugin cache, overwritten on update) and has **no effect** on a bare
  `filename` argument — the actual root-pollution case routes through `workspaceFile → cwd`
  (repo root) and bypasses `--output-dir` entirely.
- **Real, committable enforcement:**
  1. **Agent convention in `CLAUDE.md`** — never pass a bare filename; use the
     `playwright-artifacts/` prefix (relative or absolute) or omit `filename` entirely.
  2. **`playwright-artifacts/*` + `!playwright-artifacts/.gitkeep` in `.gitignore`** —
     ignores artifact contents while keeping the directory present on fresh clones (the
     screenshot tool does not `mkdir`; ENOENT is the failure mode without the committed placeholder).
  3. **Root-anchored safety net** (`/*.png`, `/*.jpg`, `/*.jpeg`) — belt-and-suspenders
     for bare-filename slips; safe because there are no tracked root-level images in this project.

**Note on `--output-dir`:** it can be set as optional per-machine hardening in
`~/.claude/plugins/cache/.../playwright/*/.mcp.json`, but it is user-local, non-portable,
and irrelevant to the bare-filename case. Not a hard enforcement opt-in.

**Acceptance:** a screenshot taken following the convention lands under `playwright-artifacts/`
(gitignored), and `git status` stays clean after a Playwright session.

**Context:** surfaced 2026-06-05 while wrapping up `bot-capture-to-inbox` (the leftover
PNGs were created during an earlier debug session). Cross-ref: `CLAUDE.md` Playwright
testing section, `.gitignore`.
