---
bootstrapped_at: 2026-05-27T04:06:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: tabzero
language_family: ts
package_manager: npm (session override; hand-off specifies bun)
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

Verbatim copy of `context/foundation/tech-stack.md`:

```yaml
---
starter_id: 10x-astro-starter
package_manager: npm
project_name: tabzero
hints:
  language_family: ts
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: cloudflare-builds
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: true
---
```

### Why this stack

Solo developer building tabzero — a personal link-capture and knowledge-management web app — in 3 weeks of after-hours work. Auth, AI-powered micro-description generation with async processing, and natural-language search are all in scope per the PRD. 10x-astro-starter wins on three load-bearing factors: (1) Supabase ships PostgreSQL + auth + row-level security out of the box, directly matching the flat user model and per-user data-isolation guardrail from the PRD; (2) the product UI is server-rendered link lists with selective interactive islands (NL search bar, 4-state closure modal, category picker) — exactly the Astro island architecture sweet spot, with no need for a full SPA runtime; (3) Cloudflare Pages/Workers edge deploy provides a generous free tier at small scale with wrangler.toml pre-wired, keeping ops cost near zero for an MVP targeting a handful of users. CI runs on Cloudflare Builds with auto-deploy-on-merge. Standard path taken; no quality-gate overrides.

---

## Pre-scaffold verification

| Signal      | Value                                                     | Severity | Notes                                                                 |
| ----------- | --------------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| npm package | not run                                                   | n/a      | `cmd_template` starts with `git clone`; no npm package name derivable |
| GitHub repo | przeprogramowani/10x-astro-starter last pushed 2026-05-17 | fresh    | from `card.docs_url`; 10 days before scaffold run                     |

---

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`

**Strategy**: git-clone (cloned starter repo; upstream `.git/` deleted before move-up)

**Exit code**: 0

**Files moved**: 18 — `astro.config.mjs`, `components.json`, `.env.example`, `eslint.config.js`, `.github/`, `.husky/`, `.nvmrc`, `.prettierrc.json`, `.vscode/`, `node_modules/`, `package.json`, `package-lock.json`, `public/`, `README.md`, `src/`, `supabase/`, `tsconfig.json`, `wrangler.jsonc`

**Conflicts (.scaffold siblings)**: `CLAUDE.md` → `CLAUDE.md.scaffold` (user's m1l3 `CLAUDE.md` wins; starter's `CLAUDE.md` sidelined)

**.gitignore handling**: append-merged — existing lines preserved; scaffold's lines de-duplicated against cwd set and appended under `# from 10x-astro-starter` separator. New additions: `.astro/`, `.env.production`, `.dev.vars`, `.wrangler/`. De-duplicated (already present): `node_modules/`, `.env`, `.vscode/`.

**.git/ handling**: upstream starter `.git/` deleted before move-up (git-clone strategy); user's own `.git/` at cwd level preserved untouched.

**context/ handling**: `context/` preserved intact — scaffold carried no `context/` directory; no drops were needed.

**.bootstrap-scaffold cleanup**: deleted

---

## Post-scaffold audit

**Tool**: `npm audit --json`

**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW

**Direct vs transitive**: 0/0/2/0 direct of total 0/1/9/0 (CRITICAL/HIGH/MODERATE/LOW)

Note: all findings are in dev-tooling or edge-runtime dependency chains (wrangler, cloudflare vite plugin, astro check, miniflare). No findings in production application code or Supabase client.

#### CRITICAL findings

None.

#### HIGH findings

| Package | Version range | Advisory            | Description                                          | CVSS | Direct?                                     | Fix                             |
| ------- | ------------- | ------------------- | ---------------------------------------------------- | ---- | ------------------------------------------- | ------------------------------- |
| devalue | 5.6.3–5.8.0   | GHSA-77vg-94rm-hx3p | Svelte devalue: DoS via sparse array deserialization | 7.5  | No (transitive via @cloudflare/vite-plugin) | Fix available (`npm audit fix`) |

#### MODERATE findings

| Package                  | Version range   | Advisory / cause                                                       | Direct? | Fix                                             |
| ------------------------ | --------------- | ---------------------------------------------------------------------- | ------- | ----------------------------------------------- |
| @astrojs/check           | >=0.9.3         | via @astrojs/language-server → volar-service-yaml                      | **Yes** | Downgrade to 0.9.2 (semver major bump required) |
| @astrojs/language-server | >=2.14.0        | via volar-service-yaml                                                 | No      | Fixed by @astrojs/check downgrade               |
| @cloudflare/vite-plugin  | <=1.37.2        | via miniflare, wrangler, ws                                            | No      | Fix available                                   |
| miniflare                | <=4.20260518.0  | via ws (GHSA-58qx-3vcg-4xpx)                                           | No      | Fix available                                   |
| volar-service-yaml       | <=0.0.70        | via yaml-language-server                                               | No      | Fixed by @astrojs/check downgrade               |
| wrangler                 | <=4.93.0        | via miniflare                                                          | **Yes** | Fix available (`npm audit fix`)                 |
| ws                       | 8.0.0–8.20.0    | GHSA-58qx-3vcg-4xpx — Uninitialized memory disclosure (CVSS 4.4)       | No      | Fix available                                   |
| yaml                     | 2.0.0–2.8.2     | GHSA-48c2-rrv3-qjmp — Stack Overflow via deeply nested YAML (CVSS 4.3) | No      | Fixed by @astrojs/check downgrade               |
| yaml-language-server     | multiple ranges | via yaml                                                               | No      | Fixed by @astrojs/check downgrade               |

#### LOW / INFO findings

None.

---

## Hints recorded but not acted on

These hand-off hint fields were read and staged into this log. No automated action was taken in bootstrapper v1; the future M1L4 skill ("Memory Architecture") will act on them.

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | cloudflare-builds    |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | true                 |
| has_background_jobs     | true                 |

**Session note**: `package_manager` was overridden to `npm` for this run (hand-off specifies `bun`). The hand-off file on disk is unchanged.

**Schema note**: `hints.language_family` is `ts` in the hand-off frontmatter; the valid enum value per the handoff schema is `js` (TypeScript is part of the JS family). Bootstrapper mapped `ts → js` internally for audit dispatch. The hand-off file on disk is unchanged — consider updating it via `/10x-tech-stack-selector`.

---

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- Review `CLAUDE.md.scaffold` (the starter's CLAUDE.md) vs your current `CLAUDE.md` (m1l3) and decide which lines to merge in.
- Run `npm audit fix` to address the `wrangler` and `@cloudflare/vite-plugin` moderate findings (non-breaking).
- The `devalue` HIGH and `@astrojs/check` moderate require a semver-major fix (`npm audit fix --force`) — review the changelog before applying.
- Address `hints.language_family: ts` in `context/foundation/tech-stack.md` (should be `js`) when convenient.
- Configure Supabase: copy `.env.example` to `.env` and fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` from your Supabase project dashboard.
- Set up Cloudflare Pages: connect the GitHub repo in the Cloudflare dashboard; build command `npm run build`, output directory `dist`.
