# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `bun run dev` — start dev server (Cloudflare workerd runtime via `wrangler`)
- `bun run build` — production build (SSR via `@astrojs/cloudflare`)
- `bun run preview` — preview production build
- `bun run lint` — ESLint with type-checked rules
- `bun run lint:fix` — auto-fix lint issues
- `bun run format` — Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss)

Pre-commit hooks (husky + lint-staged): runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

No test runner is configured yet.

## Architecture

**Astro 6 SSR app** with React 19 islands, Tailwind v4, Supabase auth, and shadcn/ui components. Deployed to Cloudflare Workers.

### Rendering mode

Full server-side rendering (`output: "server"` in `astro.config.mjs`). All pages are server-rendered by default. API routes must export `const prerender = false`.

### Auth flow

- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Reads `SUPABASE_URL` and `SUPABASE_KEY` from `astro:env/server` (server-only secrets declared in `astro.config.mjs` `env.schema`). Returns `null` if either var is missing — callers must null-check the result.
- `src/middleware.ts` — runs on every request; resolves the current user and attaches to `context.locals.user`. Redirects unauthenticated users from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected page example: `src/pages/dashboard.astro`

### Language

All generated file content must be in **English** — UI strings, code comments, `console.log` messages, error messages, variable names, commit messages, and any other text that ends up in a file. The user communicates in Polish; that does not affect the language of the output.

### Key conventions

- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths). Use it everywhere — no relative `../../` imports.
- **Component split**: Astro components for static content/layout; React components only when client-side interactivity is needed.
- **Class merging**: always use the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge). Never concatenate Tailwind class strings manually.
- **shadcn/ui**: components live in `src/components/ui/`, "new-york" style variant. Add new ones with `bunx shadcn@latest add <name>`.
- **API routes**: export uppercase `GET`, `POST`, etc.; check `context.locals.user` first (401 if absent); validate input with zod. Status codes: `201` create, `200` read/update, `204` delete; single-resource not-found/not-yours → `404` (never `403`); errors carry `{ error: "<code>" }`. Full contract (status maps, response shapes, RLS→404 rationale): **`context/foundation/api-conventions.md`** — conform to it and verify against the real endpoint, never an assumption.
- **React hooks**: extract to `src/components/hooks/`.
- **Services/helpers**: `src/lib/` for utilities; `src/lib/services/` for extracted business logic.
- **Shared types** (entities, DTOs): `src/types.ts`.
- **Strong typing — prefer unions over `string`**: when a field's value set is known and finite, define a literal union type in `src/types.ts` — never leave it as `string`. When Supabase generates `string` for a constrained column (text + CHECK constraint), narrow it in `src/types.ts` and cast with `as YourType` at the query boundary — the cast is valid because the DB constraint enforces the values at runtime; the generator just can't see it.

  ```ts
  // ✅ do
  export type ProcessingStatus = 'pending' | 'processing' | 'done' | 'failed';
  export type Role = 'owner' | 'viewer';

  // ❌ don't
  processing_status: string;
  role: string;
  ```

  ```ts
  // ✅ do — narrow at the Supabase query boundary
  const { data } = await supabase.from('links').select('*');
  return json(data as Link[]);

  // ❌ don't — let the generated string type leak into domain code
  return json(data); // data[].processing_status is string, not ProcessingStatus
  ```

- **Supabase migrations**: `supabase/migrations/` named `YYYYMMDDHHmmss_short_description.sql`. Always enable RLS on new tables with granular per-operation, per-role policies.

### Environment

- Node.js v22.14.0 (see `.nvmrc`)
- Copy `.env.example` → `.env` for Node-based tooling; copy to `.dev.vars` for Cloudflare local dev (`wrangler` reads `.dev.vars`, not `.env`)
- Local Supabase stack: `bunx supabase start` (requires Docker; Studio at `http://localhost:54323`)
- Deploy: `bunx wrangler deploy` (set `SUPABASE_URL` + `SUPABASE_KEY` as Cloudflare secrets)

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs lint + build on every push and PR to `master`. Requires `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets for the build step.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** It is the single source of truth
for the workflow — risk → seed test + rules → generate → review against the five
anti-patterns → re-prompt → verify. The skill's `references/` carry the full
rules, anti-patterns, seed pattern, and prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug; that failing-test-to-fix case is Lesson 5.

<!-- END @przeprogramowani/10x-cli -->
