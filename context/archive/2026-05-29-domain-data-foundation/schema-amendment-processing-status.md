# Schema Amendment: processing_status column on links

> Source: discovered during F-02 (`link-processing-queue`) planning session.
> Target: F-01 (`domain-data-foundation`) — add to the `links` table schema before F-02 implementation begins.
> Action for agent: amend `plan.md` for `domain-data-foundation` to include this column in the migration and type definitions. No other files need to be read to apply this change.

## What to add

Add a `processing_status` column to the `links` table in the Supabase migration.

### Column definition

```sql
processing_status text not null default 'pending'
  check (processing_status in ('pending', 'processing', 'done', 'failed'))
```

### Enum values and their meaning

| Value | Set by | Meaning |
|---|---|---|
| `pending` | S-01 (bot capture API) on insert | Job enqueued, worker has not picked it up yet |
| `processing` | S-02 consumer on job start | Worker picked up the job, scraping in progress |
| `done` | S-02 consumer on success | Description saved, visible to user |
| `failed` | S-02 consumer after all scraping tiers exhausted | Unscrapable — link kept, description absent, visually flagged in UI (FR-005) |

### Why this belongs in F-01, not F-02 or S-02

- F-02 is plumbing-only — its no-op consumer never writes to the DB. But the column must exist in the schema before S-02 lands, because S-02 transitions `pending → processing → done/failed` as part of its core flow.
- Adding the column in S-02 would require a second migration on the `links` table after F-01 already shipped — avoidable schema churn.
- The `default 'pending'` means existing rows (inserted by F-01's minimal API) get a valid value automatically — no backfill needed.

## What to add to plan.md for domain-data-foundation

In the migration phase of F-01's plan, add `processing_status` to the `CREATE TABLE links` statement alongside the other columns already planned (`url`, `micro_description`, `status`, `last_visited`, `created_at`, `user_id`).

In the TypeScript types phase (shared `src/types.ts`), add:

```ts
export type ProcessingStatus = 'pending' | 'processing' | 'done' | 'failed';
```

And include `processing_status: ProcessingStatus` in the `Link` entity type.

### RLS impact

None — `processing_status` is written by the system (consumer Worker), not directly by the user. Existing RLS policies scoped to `user_id` cover reads. The consumer Worker writes via a service-role client (same pattern as other background writes in S-02) — no additional RLS policy needed for this column.
