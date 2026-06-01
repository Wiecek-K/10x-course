# API Conventions

> Single source of truth for how tabzero's HTTP API behaves. Referenced from
> `CLAUDE.md`. Plans, plan reviews, implementations, and implementation reviews
> must conform to this — verify status codes and response shapes against the real
> endpoint, never against an assumption.
>
> Scope: server-rendered API routes under `src/pages/api/**` (Astro SSR,
> `export const prerender = false`).

## Route definition

- Export uppercase handlers: `GET`, `POST`, `PATCH`, `DELETE`, etc.
- `export const prerender = false` on every API route.
- Validate all input (body and query params) with **zod**. Schemas live in
  `src/lib/schemas/`. On failure return `400` with the issues (see error map).
- Check `context.locals.user` **first** — before parsing or touching the DB —
  and return `401` when absent.

## Success status codes

| Operation | Status | Notes |
| --- | --- | --- |
| `POST` that creates a resource | **201 Created** | Return the created resource. Never 200. |
| `GET` (read / list) | **200 OK** | — |
| `PATCH` / `PUT` (update) | **200 OK** | Return the updated resource. |
| `DELETE` | **204 No Content** | Empty body. |

Rule: a `POST` that creates a row returns **201**, not 200. When wiring side
effects (e.g. enqueuing background work) around a handler, **never silently
change an endpoint's existing success status** — wrap the side effect so its
failure cannot alter the response code.

## Error status codes

| Status | Code (`error` field) | When |
| --- | --- | --- |
| `400` | `validation_error` / `Invalid JSON` | zod validation failed / unparseable body |
| `401` | `unauthorized` | no/invalid session (`context.locals.user` absent) |
| `404` | `not_found` | single-resource read/mutate where the row isn't the caller's **or** doesn't exist |
| `500` | `server_error` | unexpected server/DB failure (log the detail server-side) |

**`404` for ownership, never `403`.** On a single-resource endpoint
(`GET`/`PATCH`/`DELETE /api/links/:id`), a row owned by another user returns
`404` — identical to a non-existent row — so the API never confirms a given id
exists. Detect via `if (!data) return 404` after `.single()`, or `count === 0`
after an update/delete. `403` is reserved for explicit section-level access
blocking (e.g. an admin area), which does not yet exist — so `403` must not
appear in the links API.

> Why this matters (the discovery): RLS silently filters cross-user rows —
> `SELECT` returns 0 rows, `UPDATE`/`DELETE` report 0 affected, all under `200`.
> Relying on that silent empty result *as* the response is a bug; RLS is the
> safety net, not the API contract. Full write-up: the "Cross-user access"
> lesson in `context/foundation/lessons.md`.

List endpoints (`GET /api/links`) are exempt — an empty array is the correct,
unambiguous answer for "you have no matching links". The 404 rule targets
**resource-by-id** operations only.

## Response body shape

- **Errors** always carry a machine-readable code: `{ "error": "<code>" }`, with
  optional extra fields (e.g. `issues` for validation). The `error` value is a
  stable code, not a human sentence.
- **Single resource** (`POST` create, `GET`/`PATCH` by id): return the resource
  object directly.
- **Collections** (`GET` list): return a named collection, e.g. `{ "links": [...] }`.
- Cast Supabase rows to the domain type at the query boundary (`data as Link[]`)
  so narrowed union types (e.g. `ProcessingStatus`) don't leak as `string`.

## Reference endpoints

- `src/pages/api/links/index.ts` — `POST` (201, returns row) + `GET` list (200, `{ links }`).
