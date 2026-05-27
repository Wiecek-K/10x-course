# Deploy Plan: tabzero — First Production Deployment

## Metadata

- **Deployed at**: 2026-05-27
- **Deployed URL**: https://tabzero.ajmag.workers.dev
- **Platform**: Cloudflare Workers (wrangler deploy)
- **Worker name**: tabzero
- **Account subdomain**: ajmag.workers.dev
- **Wrangler version**: 4.90.0
- **Version ID**: 50dc59a1-1850-4f97-9f79-11613a3c1da2

## Secrets configured

- `SUPABASE_URL` — Supabase project URL (spqdyzajvixdstalxfxx.supabase.co)
- `SUPABASE_KEY` — Supabase Publishable key (anon role)

Both set via `wrangler secret put` for the production environment.

## Bindings auto-provisioned by adapter

- `SESSION` → KV Namespace `tabzero-session` (auto-created by `@astrojs/cloudflare` for Astro Sessions)
- `IMAGES` → Cloudflare Images (auto-enabled by adapter)
- `ASSETS` → Static files from `dist/client/`

## Config fixes applied before deploy

| File | Change |
|---|---|
| `wrangler.jsonc` | `name`: `10x-astro-starter` → `tabzero` |
| `.github/workflows/ci.yml` | branch target `master` → `main` (both triggers) |

## Steps executed

| Step | Mode | Status |
|---|---|---|
| Fix wrangler.jsonc project name | Automated | ✅ |
| Fix CI branch target (master → main) | Automated | ✅ |
| Cloudflare wrangler login | Manual (browser OAuth) | ✅ |
| Create Supabase project (eu-north-1, Stockholm) | Manual (dashboard) | ✅ |
| Set SUPABASE_URL secret | Manual (own terminal) | ✅ |
| Set SUPABASE_KEY secret | Manual (own terminal) | ✅ |
| Register workers.dev subdomain (ajmag) | Manual (dashboard) | ✅ |
| `npm run build` | Automated | ✅ |
| `wrangler deploy` | Automated | ✅ |
| Supabase auth redirect URL configured | Manual (dashboard) | ✅ |
| Smoke test: signup → confirm email → signin → dashboard → signout | Manual | ✅ |

## Smoke test results

- ✅ Landing page loads
- ✅ Signup flow completes (email confirmation works)
- ✅ Dashboard accessible after login (displays logged-in email)
- ✅ Auth end-to-end verified in production

## Pending: Cloudflare Builds CI (auto-deploy-on-merge)

Not yet connected. Manual step in Cloudflare dashboard:

1. Workers & Pages → tabzero → Settings → Builds & Deployments
2. Connect GitHub repository
3. Production branch: `main`
4. Build command: `bun run build`
5. Output directory: `dist`
6. Add env vars: `SUPABASE_URL`, `SUPABASE_KEY`

## Production-access boundary

Agent may run: `wrangler deploy`, `wrangler tail`, `wrangler secret list`, `wrangler whoami`

Human must approve: rotating Supabase credentials, destructive DB migrations, changing custom domain, upgrading Workers plan tier.
