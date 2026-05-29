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
