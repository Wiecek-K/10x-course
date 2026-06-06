# Pin Playwright MCP Artifact Output — Plan Brief

> Full plan: `context/changes/playwright-mcp-output-dir/plan.md`

## What & Why

Playwright MCP screenshots land in the repo root (e.g. `verify-signin.png`) and show up as
untracked files in `git status`. We enforce the intended artifact location
(`playwright-artifacts/`) with committable, team-portable controls so a Playwright session
never dirties the repo root.

## Starting Point

The Playwright MCP server is **plugin-provided** (`~/.claude/plugins/cache/.../playwright/*/.mcp.json`),
so its `--output-dir` can't be pinned from the repo. On `main`, `.gitignore` has only
`.playwright-mcp/` (no `playwright-artifacts/`) and `CLAUDE.md` has no Playwright artifact
convention. With no pinned output-dir, a bare-filename screenshot writes to the server's
cwd = repo root.

## Desired End State

A screenshot taken via the Playwright MCP, following the documented convention, lands under
`playwright-artifacts/` (gitignored), and `git status` stays clean. Even a bare-filename
slip is caught by a targeted `.gitignore` net. Verified by a live Playwright screenshot run.

## Key Decisions Made

| Decision                            | Choice                                   | Why (1 sentence)                                                                                 | Source |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ | ------ |
| Problem diagnosis                   | Plugin server + bare filename → root cwd | Bare name bypasses gitignore'd dirs and lands in server cwd                                      | Frame  |
| Fix strategy                        | Convention (CLAUDE.md) + `.gitignore`    | Only these are committable & team-portable; pinning the plugin server isn't                      | Plan   |
| Pin `--output-dir` on plugin server | Rejected as primary                      | Server is user-home/plugin-managed; project `.mcp.json` makes a parallel server, not an override | Plan   |
| Safety net                          | Targeted root-anchored net               | Catches stray root screenshots without swallowing intended assets (none in root)                 | Plan   |
| User-local hardening                | Documented as optional                   | Lets opt-in hard enforcement without polluting the repo                                          | Plan   |
| Verification                        | Live Playwright + `git status`           | Proves real end-to-end behavior, not just static presence                                        | Plan   |
| Phasing                             | Single phase                             | LOW complexity; changes + verification fit together                                              | Plan   |

## Scope

**In scope:** `.gitignore` entries (`playwright-artifacts/` + targeted root net); `CLAUDE.md`
agent convention (absolute path under `playwright-artifacts/`, never bare filename); a
documented optional user-local `--output-dir` hardening note in `change.md`; live verification.

**Out of scope:** Disabling the plugin server or switching to a project-owned MCP server;
editing the plugin cache as the primary fix; broad recursive `*.png` ignore; broader
Playwright E2E test configuration (`/10x-e2e`).

## Architecture / Approach

Two committable controls: the **convention** (agents write to the right place) is the
primary fix; the **gitignore safety net** is belt-and-suspenders for the slip case. The
plugin server config stays untouched in the repo; hard enforcement is an optional,
per-machine opt-in.

## Phases at a Glance

| Phase               | What it delivers                                                                        | Key risk                                                               |
| ------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1. Enforce + verify | gitignore entries + CLAUDE.md convention + user-local note, verified by live screenshot | Convention relies on agent discipline — mitigated by the gitignore net |

**Prerequisites:** Worktree on the TAB-15 branch (done). Ability to dispatch a Playwright
subagent for the live verification.
**Estimated effort:** ~1 short session, single phase.

## Open Risks & Assumptions

- **Merge-order with `bot-capture-to-inbox`:** that branch adds a `## Playwright testing`
  section to `CLAUDE.md`; keep this change's addition self-contained to minimize conflict.
- **Convention depends on agent discipline** — the targeted `.gitignore` net is the
  fallback when an agent slips and passes a bare filename.
- **Assumption:** no tracked PNGs in the repo root, so a root-anchored net is safe (verify
  with `git ls-files '*.png'`).

## Success Criteria (Summary)

- Screenshot via the convention lands under `playwright-artifacts/`; `git status` clean.
- A stray root screenshot is caught by `git check-ignore`.
- `CLAUDE.md` carries a clear, self-contained artifact convention for agents.
