# Lessons

Recurring rules and pitfalls discovered during planning and implementation. Plan review agents use these as priors — a finding that repeats a known lesson here weighs more, not less.

---

## wrangler types — correct usage and flags

`wrangler types` has no `--dry-run` flag. Available options:

```
bunx wrangler types                      # generate worker-configuration.d.ts in project root
bunx wrangler types /tmp/preview.d.ts    # write to temp path to inspect without touching project
bunx wrangler types --check              # verify existing file is up to date, no write
```

Re-run after every `wrangler.jsonc` binding change (new queue, KV, R2, etc.).
Commit `worker-configuration.d.ts` — it contains runtime globals (`Queue<T>`, `ExportedHandler<Env>`, etc.) that TypeScript needs at compile time.

**Why `Cloudflare` namespace augmentation, not top-level `interface Env`:**
`wrangler types` generates `interface Env extends Cloudflare.Env {}` and populates `Cloudflare.Env` with binding types (e.g. `LINK_QUEUE: Queue<unknown>`). Adding a separate top-level `interface Env { LINK_QUEUE: Queue<QueueMessage> }` creates a merge conflict because TypeScript requires identical types for same-named properties. The correct override pattern:

```ts
declare namespace Cloudflare {
  interface Env {
    LINK_QUEUE: Queue<QueueMessage>;
  }
}
```

---

## Phase gate ordering — main entrypoint and new files

When a phase changes `wrangler.jsonc "main"` to point at a new file, that file must exist before the phase's `bun run build` gate can pass. Move the `"main"` change into the same phase that creates the entrypoint file, not the preceding phase.

---

## Cross-user access must return an explicit error, not RLS's silent empty result

**Context**: API endpoints over RLS-protected tables (e.g. `links`, scoped `auth.uid() = user_id`).

**Problem**: RLS is invisible to the caller. When user A requests a resource owned by user B, Postgres/PostgREST silently filters it out — `SELECT` returns **0 rows**, `UPDATE`/`DELETE` report **0 rows affected**, all under `200 OK`. For a **single-resource** endpoint (`GET /api/links/:id`, `PATCH`, `DELETE`) this is misleading: the caller cannot tell "this resource doesn't exist" from "it exists but isn't yours" from "the operation silently did nothing". RLS is the safety net (data never leaks), but it is **not** an API contract — relying on its empty result as the response is a bug.

**Rule**: Don't let RLS's silent filtering _be_ the response on single-resource endpoints. After the query, when 0 rows are returned/affected, return an **explicit** status instead of a `200` with an empty body:

- `401 unauthorized` — only for missing/invalid session (not authenticated). Already done in `POST`/`GET /api/links` via the `context.locals.user` check.
- `404 not_found` — authenticated but the resource isn't the caller's (or genuinely doesn't exist). **This is the locked decision**: a non-owned resource returns `404`, identical to a non-existent one, so the API never confirms that a link with a given id exists. Detect via `if (!data) return 404` after `.single()`, or `if (count === 0)` after an update/delete.

**Do NOT use `403` for ownership checks.** Team convention reserves `403 forbidden` for _explicit, section-level access blocking_ (e.g. an admin panel a normal user may not enter) — not for row-level ownership. No such gated section is planned yet, so `403` should not appear in the links API at all.

List endpoints (`GET /api/links`) are exempt — an empty array is the correct, unambiguous answer for "you have no matching links". The rule targets **resource-by-id** operations.

**Applies to**: every upcoming single-resource slice — S-04 (`GET`/`PATCH`/`DELETE /api/links/:id`), and any future endpoint that fetches or mutates one row by id. Always `404` for not-yours/not-found; `403` stays reserved for future section-level gates.

---

## Sessionless (server-to-server) endpoints can't use the cookie client — RLS will block every write

**Context**: Any endpoint with no Supabase cookie session — bot/webhook handlers, queue consumers (S-02), cron jobs, server-to-server callbacks.

**Problem**: The cookie-based client (`src/lib/supabase.ts`) resolves `auth.uid()` from the request's session. A server-to-server POST has no session, so `auth.uid()` is `NULL` and **every** RLS policy scoped `auth.uid() = user_id` fails — `INSERT`/`UPDATE` affect 0 rows under a misleading success. You cannot write a user's row through the normal client from a sessionless context.

**Rule**: For sessionless writes, choose one of two paths and isolate it:

- **Service-role client** — a separate client built from `SUPABASE_SERVICE_ROLE_KEY` that bypasses RLS. Confine it to a single helper module (`src/lib/supabase-admin.ts`) imported only by the endpoint that needs it. **The `user_id` must be resolved from a trusted server-side mapping (e.g. `telegram_links.telegram_id → user_id`), never from anything the inbound payload claims.** The key bypasses _all_ RLS — its blast radius is the whole DB if it leaks, so keep its surface tiny.
- **`SECURITY DEFINER` Postgres function (RPC)** — the privilege lives in one narrow SQL function; the Worker calls it with the ordinary anon key, no master key in app code. Cleaner long-term; more DB work up front.

**Decision for the bot (S-01)**: service-role, as the MVP-pragmatic choice; migrate to `SECURITY DEFINER` RPC post-MVP (Linear TAB-13). The trade-off and its tracking issue live in `roadmap.md` §S-01.

**Applies to**: S-01 bot webhook insert, S-02 queue-consumer writes, S-06 categorization routing, and any future webhook/cron/consumer that writes on a user's behalf.

---

## Webhook response codes: reject forged with non-2xx, ack authentic with 200 (or the sender retries)

**Context**: Inbound webhooks from providers that retry on non-2xx (Telegram, Stripe, GitHub, …).

**Rule**: Split the two cases. A **forged/unauthenticated** request (failed shared-secret check, e.g. Telegram's `X-Telegram-Bot-Api-Secret-Token`) → return **`401`** so it's rejected. An **authentic** update you've received → return **`200`** even when the business outcome is "nothing to do" (expired token, unknown sender, no URL in the message); a non-2xx there makes the provider **redeliver the same update**, causing duplicate processing. Side effects (replies, inserts) happen as separate calls, not via the webhook's response body.

**Applies to**: S-01 bot webhook; any future provider-webhook integration.

---

## Generated files belong in ESLint `ignores`, not in the lint surface

**Context**: Files produced by a code generator and committed to the repo — `worker-configuration.d.ts` (`wrangler types`), `src/db/database.types.ts` (Supabase type gen), and any future generated artifact.

**Problem**: Generated files are overwritten wholesale by their tool on every regen, so any lint "fix" applied to them is erased on the next run. They also routinely violate the project's own rules — empty interfaces (`interface Env extends Cloudflare.Env {}`), `any`, non-conventional formatting — and often ship their own `/* eslint-disable */` header. Leaving them in the lint surface makes `bun run lint` fail on code you neither wrote nor control, training everyone to ignore red lint output.

**Rule**: When a generator emits a committed file, add it to the `ignores` array in `eslint.config.js` in the **same change** that introduces it. Enforce style on hand-written code only; let the generator own its output. This mirrors the existing entry for `src/db/database.types.ts` — keep the list as the single home for "tool-owned, do-not-lint" files.

```js
// eslint.config.js
{ ignores: ["src/db/database.types.ts", "worker-configuration.d.ts"] },
```

**Applies to**: every generated, committed artifact — current (`wrangler types`, Supabase types) and future (OpenAPI clients, codegen'd SDKs, etc.). New binding in `wrangler.jsonc` → re-run `wrangler types` → confirm the file is already covered by `ignores`.

---

## RLS policy coverage must span every operation the app performs across all phases

**Context**: Designing granular per-operation RLS policies for a new table, when the table is created in an early phase but written/mutated by code in later phases (e.g. `pairing_codes` created in Phase 1, mutated in Phase 2).

**Problem**: This is a distinct failure mode from the cross-user and sessionless lessons above. Here it's the **legitimate owner**, on the authenticated cookie client, performing an operation for which **no policy was granted**. Postgres doesn't error — a missing `UPDATE`/`DELETE` policy means the statement matches no rows and silently reports **0 rows affected** under `200 OK`. The bug surfaces phases later than the table design: Phase 1 grants only `SELECT` + `INSERT` "because the app only reads and mints," then Phase 2 needs to expire/delete the user's own prior rows and that mutation silently no-ops. The intended invariant ("only the latest row is live") never holds, and nothing fails loudly.

**Rule**: Before locking a table's policy set, enumerate **every** operation the application will perform on it across **all** planned phases — not just the operations the creating phase needs. For each (operation, role) the app will actually issue, there must be a matching policy, or the statement fails silently. If a later phase reveals a needed operation, add the policy in that phase's migration (or route the write through the service-role/admin client when it's genuinely a privileged, sessionless path — see the sessionless lesson). When you _deliberately_ omit a policy (e.g. "rows are only ever burned by the service-role webhook, never by the user"), make sure no app code path on the ordinary client is expected to perform that operation — if one is, drop the requirement or grant the policy.

**Applies to**: every new RLS table whose lifecycle spans multiple phases — `pairing_codes`/`telegram_links` (S-01), and any future table where the creating phase's policy set is narrower than what later phases need.

---

## Supabase Realtime broadcasts every WAL change regardless of writer; RLS governs only the subscriber's visibility

**Context**: A browser island subscribed to Supabase Realtime `postgres_changes` on an RLS-protected table, where rows may be written by a **service-role** (RLS-bypassing) path — bot webhook (S-01), queue consumer (S-02), categorization routing (S-06).

**Problem / non-obvious win**: It's natural to assume a row inserted by the service-role client (which bypasses RLS) won't reach a Realtime subscriber, or conversely that bypassing RLS on write also bypasses it on the stream. Neither is true. Realtime reads the **WAL**, so it broadcasts the change no matter which role wrote it. RLS is then applied to the **subscriber's** session token to decide who receives the event — the same `SELECT` policy that governs a normal read. Net effect: a service-role insert with the correct `user_id` is delivered to exactly the owning user's subscription and to no one else's.

**Rule**: For a "server writes (service-role) → user's browser sees it live" flow you do **not** need any special Realtime trick beyond (1) adding the table to the `supabase_realtime` publication and (2) a correct per-user `SELECT` RLS policy. The browser must subscribe with the **authenticated** client (`createBrowserClient` carrying the user's JWT), filtered by `user_id`, so RLS scopes the stream. Do not weaken RLS or expose a privileged channel to make push work — the standard `SELECT` policy already does the filtering on the receive side.

**Applies to**: S-01 inbox (bot service-role insert → Realtime push), S-02 (consumer writes description → live update), S-06 (routing), and any future background/service-role write surfaced live in the UI.

---

## A write path that bypasses the canonical API endpoint also bypasses its side effects

**Context**: A feature inserts/updates domain rows through a path other than the established API endpoint — e.g. the bot webhook inserts into `links` via the admin client directly, instead of `POST /api/links`.

**Problem**: Side effects wired into the canonical endpoint (queue enqueue, event emission, audit log, derived-field updates) live in that endpoint's handler, not in the table or a trigger. A second write path that goes straight to the table silently skips all of them. In S-01 this surfaced as: `POST /api/links` calls `enqueueLink(...)` after insert, but the bot's direct admin insert did not — so bot-captured links (the product's _primary_ capture channel) would never enter the S-02 processing pipeline, while desktop links would. The divergence is invisible until the downstream consumer exists and you notice one source's rows are never processed.

**Rule**: When introducing a write path that bypasses the canonical endpoint, audit what that endpoint does **after** the bare insert and replicate the relevant side effects (or move the shared side effect into a DB trigger / shared service function both paths call). List the endpoint's post-insert actions and decide per-action: replicate, or consciously defer with a tracked note. Don't assume "insert the row" is the whole job — the endpoint usually isn't just an insert.

**Applies to**: S-01 bot webhook (must `enqueueLink` like `POST /api/links`), S-05 extension capture, and any future capture channel or background writer that doesn't go through the existing domain endpoint.

---

## Astro server env vars must use `access: "secret"`, never `access: "public"`

**Context**: Declaring server-side env fields in `astro.config.mjs` `env.schema` — any `envField` with `context: "server"`.

**Problem**: `access: "public"` tells Astro to inline the variable's value at build time as a constant. During `astro build` / CI the variable is usually unset (`.dev.vars` is not loaded), so Astro inlines `undefined`. Any guard like `if (!SOME_VAR)` then evaluates to `if (true)` at build time, causing esbuild's dead-code elimination to strip everything after it. The endpoint compiles to an unconditional early-return and always responds 500 — with no runtime error, no warning, and no indication that entire branches of logic were silently removed.

**Rule**: For every `context: "server"` field in `env.schema`, always set `access: "secret"`. This forces runtime resolution from the Worker environment instead of build-time inlining, so guards evaluate correctly in production. `access: "public"` on a server field gives no meaningful benefit (the var is server-only regardless) and carries a silent dead-code risk.

**Applies to**: plan, implement, impl-review — whenever adding or reviewing `env.schema` entries in `astro.config.mjs`.
