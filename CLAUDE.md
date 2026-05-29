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
- **API routes**: export uppercase `GET`, `POST`, etc.; validate input with zod.
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

## 10xDevs AI Toolkit - Module 2, Lesson 2

Turn one roadmap item into the first implementation cycle with the **change planning chain**:

```
/10x-roadmap -> /10x-new -> /10x-plan -> /10x-plan-review -> /10x-implement
```

`/10x-new`, `/10x-plan`, `/10x-plan-review`, and `/10x-implement` are the lesson focus. `/10x-frame` and `/10x-research` are not required rituals here; they are escalation paths introduced in the next lesson.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Change setup (lesson focus)** | |
| `/10x-new <change-id>` | You selected a roadmap item and need a stable change folder. Creates `context/changes/<change-id>/change.md` so planning, implementation, progress, commits, and later review all share one identity. Use AFTER roadmap selection, BEFORE `/10x-plan`. |
| **Planning (lesson focus)** | |
| `/10x-plan <change-id>` | You have a change folder and need a reviewable implementation plan. Reads roadmap context, foundation docs, codebase evidence, and any existing change notes; writes `plan.md` and `plan-brief.md` with phases, file contracts, success criteria, and `## Progress`. |
| **Plan readiness (lesson focus)** | |
| `/10x-plan-review <change-id>` | You have `plan.md` and need a light pre-code readiness check. Use it to catch missing end state, weak contracts, malformed progress, scope drift, or blind spots before code changes begin. |
| **Implementation (lesson focus)** | |
| `/10x-implement <change-id> phase <n>` | You have an approved plan and want to execute one phase with verification, manual gate, commit ritual, and SHA write-back to `## Progress`. |
| **Lifecycle closure** | |
| `/10x-archive <change-id>` | A change is merged or intentionally closed. Move it out of active `context/changes/` into archive state. |

### How the chain hands off

- `/10x-new` creates the durable change identity.
- `/10x-plan` turns that identity into an implementation contract.
- `/10x-plan-review` checks the plan before the agent mutates code.
- `/10x-implement` executes one planned phase, verifies, asks for manual confirmation when needed, commits, and records progress.

### Lesson boundaries

- Plan is the default router after roadmap selection. Start with `/10x-plan` unless the problem is unclear or external evidence is blocking.
- Do not run `/10x-frame + /10x-research` as ceremony for every change.
- Do not turn this lesson into a full end-to-end product build. A checkpoint with a planned and partially or fully implemented stream is valid.
- Code review of the implemented diff belongs to Lesson 3 via `/10x-impl-review`.
- Lifecycle closure via `/10x-archive` after a change is merged or intentionally closed.

### Paths used by this lesson

- `context/foundation/roadmap.md` - upstream roadmap
- `context/changes/<change-id>/change.md` - change identity
- `context/changes/<change-id>/plan.md` - implementation contract
- `context/changes/<change-id>/plan-brief.md` - compressed handoff
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
