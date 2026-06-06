---
title: Configure Playwright to always output artifacts to playwright-artifacts/
date: 2026-06-04
source: session observation
---

## Problem

When an agent (or user) runs Playwright via the MCP plugin, screenshots land in the project root instead of a dedicated, gitignored folder. This causes untracked files like `verify-*.png` that pollute `git status`.

## Desired state

- `playwright.config.ts` sets `outputDir: "playwright-artifacts/"` and `screenshotsDir: "playwright-artifacts/screenshots/"` so every artifact goes there automatically.
- `.gitignore` already covers `playwright-artifacts/` and `test-results/` (added 2026-06-04).
- CLAUDE.md or a skill instructs agents to pass `filename: "playwright-artifacts/<name>.png"` when calling `browser_take_screenshot`.
- `playwright-artifacts/` folder committed with a `.gitkeep` so the path exists.

## Scope

Small infrastructure task — no feature work. Can be done as a standalone chore commit.
