---
title: Add vitest + @cloudflare/vitest-pool-workers to enable unit testing of services that use astro:env/server virtual module
date: 2026-06-08
slice: S-02
trigger: S-02 · auto-description-pipeline
status: raw
---

**Value:** Developer can run isolated unit tests for service functions (mock path, error taxonomy, fixture loading) without needing a full wrangler dev runtime.

**Context:** `astro:env/server` is a virtual module resolved only inside wrangler/Astro runtime. Plain `bun test.ts` crashes with `Cannot find module 'astro:env/server'`. This means `firecrawl.ts`, `describe.ts`, `mock.ts` can't be imported in ordinary test scripts — the only verification available is code review + build pass.

**Solution:** `vitest` + `@cloudflare/vitest-pool-workers` runs tests inside miniflare (local Workers runtime), which resolves all wrangler virtual modules including `astro:env/server`. Tests can set env vars, import services directly, and assert mock/real code paths without running `wrangler dev` + a live queue.
