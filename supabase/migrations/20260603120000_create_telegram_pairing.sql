-- Ephemeral one-time pairing tokens: web app mints, bot webhook burns
CREATE TABLE public.pairing_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pairing_codes_token ON public.pairing_codes (token);

ALTER TABLE public.pairing_codes ENABLE ROW LEVEL SECURITY;

-- Authenticated web user can mint and read their own codes
CREATE POLICY pairing_codes_select_authenticated
  ON public.pairing_codes
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY pairing_codes_insert_authenticated
  ON public.pairing_codes
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- UPDATE and DELETE are intentionally omitted: only the service-role webhook
-- burns tokens (sets used_at), bypassing RLS. The authenticated client never
-- needs to mutate an existing code — it only mints new ones. (TAB-13)

-- Permanent Telegram ↔ user mapping: set once by pairing, never by the user
CREATE TABLE public.telegram_links (
  telegram_id bigint PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_links_user_id ON public.telegram_links (user_id);

ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

-- Authenticated user can read their own mapping (e.g. to show "Connected ✅")
CREATE POLICY telegram_links_select_authenticated
  ON public.telegram_links
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- INSERT, UPDATE, DELETE are intentionally omitted: only the service-role
-- webhook writes the mapping, bypassing RLS. (TAB-13)
