-- Add nullable note column for kept library rows (A2 / editable via A5)
ALTER TABLE public.links ADD COLUMN note text;
