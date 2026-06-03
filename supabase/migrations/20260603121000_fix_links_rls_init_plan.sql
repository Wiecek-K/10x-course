-- Fix Auth RLS Initialization Plan warnings on public.links.
-- Replace auth.uid() with (select auth.uid()) so Postgres evaluates it once
-- per query rather than once per row, eliminating the per-row function call overhead.
DROP POLICY IF EXISTS links_select_authenticated ON public.links;
DROP POLICY IF EXISTS links_insert_authenticated ON public.links;
DROP POLICY IF EXISTS links_update_authenticated ON public.links;
DROP POLICY IF EXISTS links_delete_authenticated ON public.links;

CREATE POLICY links_select_authenticated
  ON public.links
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY links_insert_authenticated
  ON public.links
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY links_update_authenticated
  ON public.links
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY links_delete_authenticated
  ON public.links
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
