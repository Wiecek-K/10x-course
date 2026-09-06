-- Realtime DELETE events carry only the replica-identity columns in their
-- `old` payload. With the default (PK-only) identity a DELETE exposes just
-- `id`, so a Realtime subscription filtered by `user_id` never matches and
-- delete events are never delivered cross-tab. REPLICA IDENTITY FULL puts
-- every column into the WAL old-tuple, restoring the user_id filter on DELETE.
ALTER TABLE public.links REPLICA IDENTITY FULL;
