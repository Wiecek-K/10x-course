---
change_id: link-processing-queue
roadmap_id: F-02
status: plan_reviewed
created: 2026-05-29
updated: 2026-05-29
---

# Change: link-processing-queue

Cloudflare Queue `tabzero-link-processing` wired as a plumbing-only foundation.
Producer helper importable from `src/lib/queue.ts`. No-op consumer in `src/worker.ts`.
Unblocks S-02 (auto-description pipeline) and S-06 (category routing).

## Prerequisites

- F-01 (`domain-data-foundation`) complete — link-creation endpoint and `links` schema must exist before wiring the producer.
- F-01 schema must include `processing_status` column — see `context/changes/domain-data-foundation/schema-amendment-processing-status.md`.
