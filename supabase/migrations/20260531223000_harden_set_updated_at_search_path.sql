-- Harden set_updated_at() against search_path manipulation.
-- Resolves Supabase linter advisory `function_search_path_mutable`.
-- Body only calls now() (pg_catalog, always implicitly in path) and mutates NEW,
-- so an empty search_path is safe.
ALTER FUNCTION public.set_updated_at() SET search_path = '';
