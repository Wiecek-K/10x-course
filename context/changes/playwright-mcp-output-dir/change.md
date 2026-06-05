---
change_id: playwright-mcp-output-dir
title: Pin Playwright MCP artifact output to gitignored dir (stop root-level screenshots)
status: new
created: 2026-06-05
updated: 2026-06-05
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

**Proposed fix (verify mechanism for plugin-provided MCP server during planning):**

- Pin the Playwright MCP server's `--output-dir` to an absolute, gitignored path
  (`playwright-artifacts/`). `@playwright/mcp` supports `--output-dir <path>`. Determine
  how to override args for a plugin MCP server (project `.mcp.json` vs plugin settings).
- Add a convention to `CLAUDE.md` (Playwright section): agents always pass an **absolute
  path** under `playwright-artifacts/` to `browser_take_screenshot`, never a bare filename.
- (Optional safety net) broad `.gitignore` rule for stray root screenshots — band-aid;
  the real fix is the pinned output-dir.

**Acceptance:** a screenshot taken with a bare filename lands under `playwright-artifacts/`
(gitignored), and `git status` stays clean after a Playwright session.

**Context:** surfaced 2026-06-05 while wrapping up `bot-capture-to-inbox` (the leftover
PNGs were created during an earlier debug session). Cross-ref: `CLAUDE.md` Playwright
testing section, `.gitignore`.
