---
starter_id: 10x-astro-starter
package_manager: bun
project_name: tabzero
hints:
  language_family: js
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

## Why this stack

Solo developer building tabzero — a personal link-capture and knowledge-management web app — in 3 weeks of after-hours work. Auth, AI-powered micro-description generation with async processing, and natural-language search are all in scope per the PRD. 10x-astro-starter wins on three load-bearing factors: (1) Supabase ships PostgreSQL + auth + row-level security out of the box, directly matching the flat user model and per-user data-isolation guardrail from the PRD; (2) the product UI is server-rendered link lists with selective interactive islands (NL search bar, 4-state closure modal, category picker) — exactly the Astro island architecture sweet spot, with no need for a full SPA runtime; (3) Cloudflare Pages/Workers edge deploy provides a generous free tier at small scale with wrangler.toml pre-wired, keeping ops cost near zero for an MVP targeting a handful of users. CI runs on Cloudflare Builds with auto-deploy-on-merge. Standard path taken; no quality-gate overrides.
