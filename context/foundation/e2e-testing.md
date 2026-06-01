# E2E Testing Guide

Local end-to-end testing uses `wrangler dev` (not `bun run dev`) + Playwright MCP.

## Prerequisites

- **Playwright MCP** configured with system Chromium — `.mcp.json` must pass `--executable-path /usr/bin/chromium` (Arch Linux; bundled Playwright browsers do not work due to library mismatches).
- **Test account credentials** — stored in `.env.test` (gitignored). Copy `.env.test.example` → `.env.test` and fill in values. Variables: `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`.
- **`.dev.vars`** — points to remote Supabase; test account must exist there.

## Starting the dev server

```bash
# From project root — NOT bun run dev (astro dev won't trigger queue consumers)
bunx wrangler dev --port 8787 > /tmp/wrangler-dev.log 2>&1 &

# Wait ~12s, then verify ready:
grep "Ready on" /tmp/wrangler-dev.log
```

## Playwright login flow

Read credentials from `.env.test` before starting (`E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`).

```bash
# Load credentials into shell
export $(grep -v '^#' .env.test | xargs)
```

```
1. browser_navigate → http://localhost:8787/auth/signin

2. browser_fill_form:
     - target: "input[type='email']"    value: $E2E_TEST_EMAIL
     - target: "input[type='password']" value: $E2E_TEST_PASSWORD

3. browser_click → "button[type='submit'], button:has-text('Sign in')"

4. Verify: page URL becomes http://localhost:8787/ (success)
   Error state: URL contains ?error=Invalid%20login%20credentials
```

Use CSS selectors (`input[type='email']`), not `ref=eN` ids — refs change between snapshots.

## Calling API endpoints in browser context

Use `browser_evaluate` to call API routes with the active session cookie automatically included:

```js
async () => {
  const res = await fetch('/api/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com/test' })
  });
  return { status: res.status, body: await res.json() };
}
```

## Queue consumer verification

After triggering a queue-producing action, poll the wrangler log:

```bash
until grep -qE "consumed|enqueue failed" /tmp/wrangler-dev.log; do sleep 2; done
grep -E "queue|consumed|describe|enqueue" /tmp/wrangler-dev.log
# expect: [queue] consumed describe v1 for link <linkId>
```

## Playwright MCP config (Arch Linux)

Both plugin files must contain `--executable-path /usr/bin/chromium`:

```
~/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/playwright/.mcp.json
~/.claude/plugins/cache/claude-plugins-official/playwright/unknown/.mcp.json
```

If a plugin update resets them:

```bash
sed -i 's/"@playwright\/mcp@latest"/"@playwright\/mcp@latest", "--executable-path", "\/usr\/bin\/chromium"/' \
  ~/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/playwright/.mcp.json \
  ~/.claude/plugins/cache/claude-plugins-official/playwright/unknown/.mcp.json
```
