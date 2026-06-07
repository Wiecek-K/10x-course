---
date: 2026-06-06T20:32:59+02:00
researcher: Wiecek-K
git_commit: 9c503175bb29d22310bc9d5b2fcf7c6b1bcf7369
branch: krystiandwiecek/tab-15-pin-playwright-mcp-artifact-output-to-gitignored-dir-stop
repository: 10x-course
topic: "How @playwright/mcp resolves the screenshot `filename` arg vs `outputDir` — and whether the CLAUDE.md absolute-path convention (F1) is an effective fix"
tags: [research, playwright-mcp, screenshots, gitignore, tab-15, F1]
status: complete
last_updated: 2026-06-06
last_updated_by: Wiecek-K
---

# Research: Playwright MCP `filename` → `outputDir` resolution (F1)

**Date**: 2026-06-06T20:32:59+02:00
**Researcher**: Wiecek-K
**Git Commit**: 9c50317
**Branch**: krystiandwiecek/tab-15-pin-playwright-mcp-artifact-output-to-gitignored-dir-stop
**Repository**: 10x-course

## Research Question

How does the plugin-provided Playwright MCP server (`@playwright/mcp`) resolve the
`browser_take_screenshot` `filename` argument relative to `outputDir`? When no
`--output-dir` is set and an agent passes an absolute path under `playwright-artifacts/`,
does the file land there, or is the path basename-sanitized and written to the server cwd
(repo root)? This decides whether the `CLAUDE.md` "absolute path" convention in the
`playwright-mcp-output-dir` plan (Phase 1, finding **F1**) is an effective primary fix, or
whether `--output-dir` is the only real lever. Cover: the filename→outputDir resolution
logic, any path-traversal sanitization, how to override args for a plugin-provided MCP
server, and which controls are committable / team-portable.

## Summary

**F1's hypothesis is wrong, but the plan has a different, real gap.**

Investigated against the **actual installed source** (`@playwright/mcp` **0.0.75**,
bundled into `playwright-core` 1.61.0-alpha) and confirmed with a **live probe**.

1. **There is NO basename sanitization.** A provided `filename` is resolved with
   `path.resolve(cwd, filename)` — absolute paths are honored as-is, relative paths join
   onto the workspace (cwd). So an absolute (or relative) path under `playwright-artifacts/`
   targets exactly the right place. **The convention is mechanically valid.**

2. **The real lever is the workspace cwd, not `outputDir`.** When the agent passes a
   `filename`, the screenshot tool routes through `workspaceFile()` (resolves against
   **cwd = repo root**), _not_ `outputFile()` (which uses `outputDir`). `outputDir`
   (default `<cwd>/.playwright-mcp`, already gitignored) governs only **auto-named**
   artifacts (when `filename` is omitted) — snapshots, console logs, and unnamed
   screenshots.

3. **The bug is the bare filename.** `path.resolve(repoRoot, "verify-signin.png")` =
   repo root. **Reproduced live**: a bare `probe-bare.png` landed in the repo root and
   showed up as `?? probe-bare.png` in `git status`. This matches the original symptom
   exactly.

4. **NEW critical finding (supersedes F1):** `workspaceFile()` does **not** create
   directories (only `outputFile()` calls `mkdir`). The live probe with both the absolute
   and relative `playwright-artifacts/...` paths **failed with `ENOENT`** because
   `playwright-artifacts/` does not exist on disk. Git does not track empty directories,
   so on a fresh clone the convention's target dir is absent and **every "follow the
   convention" screenshot errors out** until someone manually `mkdir`s it. The plan must
   commit a `playwright-artifacts/.gitkeep` (or equivalent) or the convention is
   dead-on-arrival.

5. **No committable way to change the plugin server's args/cwd.** The server is
   plugin-provided from `~/.claude` (two cache entries), launched by the harness with
   `cwd = clientInfo.cwd` (the workspace root). A project `.mcp.json` makes a _parallel_
   server under a different tool namespace, not an override. `PLAYWRIGHT_MCP_OUTPUT_DIR`
   exists but (a) isn't committable for a plugin server and (b) only affects the
   auto-named path, not the bare-filename-to-root bug. **The only committable,
   team-portable controls are: the `CLAUDE.md` convention, the `.gitignore` net, and a
   committed `playwright-artifacts/.gitkeep`.**

### Bottom line for triage

- **F1 → DISMISS** (the "basename-sanitize / absolute collapses to root" hypothesis is
  false; the convention works).
- **Add a new must-fix to the plan**: commit `playwright-artifacts/.gitkeep` so the
  convention's directory exists after clone. Without it the convention fails with ENOENT.
- **Clarify the convention wording**: any path containing the `playwright-artifacts/`
  prefix works (absolute _or_ relative); only a **bare** filename lands in root. Omitting
  `filename` is also safe (→ `.playwright-mcp/`, gitignored, auto-created).
- The `.gitignore` root net (`/*.png` + jpg/jpeg) remains justified for the bare-filename
  slip case (proven to dirty `git status`).

## Detailed Findings

### Resolution logic (source — `playwright-core/lib/coreBundle.js`, v0.0.75)

Two distinct file-resolution paths, selected by whether the agent supplied a `filename`:

**Path A — provided `filename` (the agent's case):**

- `browser_take_screenshot` handler builds the template with
  `suggestedFilename: params.filename` and calls `response.resolveClientFile(...)`
  (`coreBundle.js:58556`).
- `resolveClientFile` → when `suggestedFilename` is set, calls `resolveClientFilename`
  (`coreBundle.js:58691-58694`).
- `resolveClientFilename` → `context.workspaceFile(filename, clientWorkspace)`
  (`coreBundle.js:58701-58702`).
- `workspaceFile` resolves against **cwd**, then `checkFile`, and **does not mkdir**
  (`coreBundle.js:58227-58232`):
  ```js
  async function workspaceFile(options, fileName, perCallWorkspaceDir) {
    const workspace = perCallWorkspaceDir ?? options.cwd;
    const resolvedName = path.resolve(workspace, fileName); // absolute wins; relative joins cwd
    await checkFile(options, resolvedName, { origin: "llm" });
    return resolvedName; // NB: no fs.mkdir here
  }
  ```

**Path B — no `filename` (auto-named):**

- `resolveClientFile` → `context.outputFile(template, { origin: "llm" })`
  (`coreBundle.js:58695-58696`).
- `outputFile` resolves against **outputDir** and **does mkdir**
  (`coreBundle.js:58241-58246`):
  ```js
  async function outputFile(options, fileName, flags) {
    const resolvedFile = path.resolve(outputDir(options), fileName);
    await checkFile(options, resolvedFile, flags);
    await fs.promises.mkdir(path.dirname(resolvedFile), { recursive: true }); // creates dirs
    return resolvedFile;
  }
  ```
- Default `outputDir` (`coreBundle.js:58233-58239`):
  ```js
  function outputDir(options) {
    if (options.config.outputDir) return path.resolve(options.config.outputDir);
    const baseName = options.config.skillMode ? ".playwright-cli" : ".playwright-mcp";
    if (isSystemDirectory(options.cwd) || !isWritable(options.cwd)) return path.join(os.tmpdir(), baseName);
    return path.join(options.cwd, baseName); // default = <cwd>/.playwright-mcp
  }
  ```

**Access guard (`checkFile`, `coreBundle.js:58248-58254`):** for LLM-origin names, the
resolved path must be inside the outputDir **or** the workspace (cwd), else it throws
`File access denied`. An absolute path under `<repo>/playwright-artifacts/` is inside the
workspace → allowed. (Bypassed by `allowUnrestrictedFileAccess` / `skillMode`, neither set
here.)

**cwd origin:** `cwd: firstRootPath(clientRoots)` (`coreBundle.js:65089`) and
`outputDir({ config, cwd: clientInfo.cwd })` (`coreBundle.js:66471`) — the workspace root
is supplied by the Claude Code harness via MCP client roots. In this worktree that is the
repo root, confirmed by the probe.

### Live probe (empirical, v0.0.75, this worktree)

Navigated to `https://example.com`, then three screenshots:

| `filename` arg                                                  | Resolved target                             | Result                                                                  |
| --------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| `/mnt/.../tab-15/playwright-artifacts/probe-abs.png` (absolute) | `<repo>/playwright-artifacts/probe-abs.png` | **ENOENT** — dir missing, no mkdir                                      |
| `playwright-artifacts/probe-rel.png` (relative)                 | `<repo>/playwright-artifacts/probe-rel.png` | **ENOENT** — same target, dir missing                                   |
| `probe-bare.png` (bare)                                         | `<repo>/probe-bare.png`                     | **WROTE to repo root**; appeared as `?? probe-bare.png` in `git status` |

Auto-named artifacts from the navigate step landed in `.playwright-mcp/`
(`page-*.yml`, `console-*.log`) — confirming Path B / default outputDir. The stray
`probe-bare.png` was removed; `git status` is clean.

This proves: (1) absolute and relative `playwright-artifacts/` paths resolve to the
**same correct location** (no sanitization, absolute honored) but require the dir to
pre-exist; (2) the bare filename is the actual root-pollution bug.

### Override & portability (plugin-provided server)

- Plugin server definitions (user-home, non-committable, reset on plugin update):
  - `~/.claude/plugins/cache/claude-plugins-official/playwright/3d368d2972d9/.mcp.json` →
    `npx @playwright/mcp@latest`
  - `~/.claude/plugins/cache/claude-plugins-official/playwright/unknown/.mcp.json` →
    `npx @playwright/mcp@latest --executable-path /usr/bin/chromium`
- Agents call `mcp__plugin_playwright_playwright__*` (allowlisted in
  `.claude/settings.local.json:21-31`). A project `.mcp.json` named `playwright` would
  surface as `mcp__playwright__*` — a **different, unused** server, not an override.
- Env levers exist (`coreBundle.js:65484-65514`): `PLAYWRIGHT_MCP_OUTPUT_DIR`,
  `PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS`, etc. But `PLAYWRIGHT_MCP_OUTPUT_DIR`
  only changes Path B (auto-named, already in `.playwright-mcp`); it does **not** affect
  Path A (provided filename → cwd), so it cannot fix the bare-filename-to-root bug. And
  there is no committable place to set env for the plugin-launched server from the repo.

## Code References

- `coreBundle.js:58227-58232` — `workspaceFile()`: `path.resolve(cwd, fileName)`, no mkdir (Path A)
- `coreBundle.js:58233-58239` — `outputDir()`: default `<cwd>/.playwright-mcp`
- `coreBundle.js:58241-58246` — `outputFile()`: `path.resolve(outputDir, …)` + mkdir (Path B)
- `coreBundle.js:58248-58254` — `checkFile()`: allow inside outputDir OR workspace
- `coreBundle.js:58536-58565` — `browser_take_screenshot` handler
- `coreBundle.js:58691-58702` — `resolveClientFile` / `resolveClientFilename` (Path A vs B fork)
- `coreBundle.js:65089`, `:66471` — cwd = `clientInfo.cwd` (harness-provided workspace root)
- `coreBundle.js:65484-65514` — env config (`PLAYWRIGHT_MCP_OUTPUT_DIR`, etc.)
- `.claude/settings.local.json:21-31` — `mcp__plugin_playwright_playwright__*` allowlist
- `.gitignore:49-50` — only `.playwright-mcp/` present today

## Architecture Insights

- The MCP draws a deliberate boundary: **agent-named files go to the workspace (cwd)**,
  **tool-named files go to outputDir**. The plan conflated the two. The convention only
  needs the agent to include the `playwright-artifacts/` prefix; "absolute" isn't special
  beyond being cwd-independent.
- The default outputDir (`.playwright-mcp`) is already gitignored, so the _out-of-the-box_
  behavior for unnamed screenshots is already clean. The whole problem is scoped to the
  agent passing a **bare** filename.
- Because `workspaceFile` skips `mkdir`, any committed-convention pointing at a
  gitignored, empty directory must ship a tracked placeholder (`.gitkeep`) or fail.

## Historical Context (from prior changes)

- `context/changes/playwright-mcp-output-dir/change.md` — original root-cause chain
  (plugin server + bare filename → cwd) is **correct**; the proposed primary fix (pin
  `--output-dir`) is the wrong lever for the bare-filename case.
- `context/changes/playwright-mcp-output-dir/plan.md` — F1 in the plan review assumed
  absolute paths might be basename-sanitized to root; this research **refutes** that and
  surfaces the `.gitkeep`/ENOENT gap instead.
- Memory S381/997 — the two leftover root PNGs from the earlier debug session were
  bare-filename screenshots; consistent with the reproduced bug.

## Open Questions

- Should the convention recommend **omitting** `filename` (→ `.playwright-mcp/`, zero new
  infra) as the default for throwaway verification shots, reserving explicit
  `playwright-artifacts/<name>.png` for artifacts worth keeping/naming? (Leaner; trades
  away chosen filenames.)
- Confirm the worktree cwd assumption holds for non-worktree clones (it should — cwd is
  the client root in both), and that `clientInfo.cwd` is always the project root rather
  than a subdir from which the agent launched.
