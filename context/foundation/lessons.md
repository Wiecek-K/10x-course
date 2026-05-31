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

**Rule**: Don't let RLS's silent filtering *be* the response on single-resource endpoints. After the query, when 0 rows are returned/affected, return an **explicit** status instead of a `200` with an empty body:
- `401 unauthorized` — only for missing/invalid session (not authenticated). Already done in `POST`/`GET /api/links` via the `context.locals.user` check.
- `404 not_found` — authenticated but the resource isn't the caller's (or genuinely doesn't exist). **This is the locked decision**: a non-owned resource returns `404`, identical to a non-existent one, so the API never confirms that a link with a given id exists. Detect via `if (!data) return 404` after `.single()`, or `if (count === 0)` after an update/delete.

**Do NOT use `403` for ownership checks.** Team convention reserves `403 forbidden` for *explicit, section-level access blocking* (e.g. an admin panel a normal user may not enter) — not for row-level ownership. No such gated section is planned yet, so `403` should not appear in the links API at all.

List endpoints (`GET /api/links`) are exempt — an empty array is the correct, unambiguous answer for "you have no matching links". The rule targets **resource-by-id** operations.

**Applies to**: every upcoming single-resource slice — S-04 (`GET`/`PATCH`/`DELETE /api/links/:id`), and any future endpoint that fetches or mutates one row by id. Always `404` for not-yours/not-found; `403` stays reserved for future section-level gates.
