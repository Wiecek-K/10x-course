// RLS-bypassing admin client — import ONLY from the bot webhook endpoint and the queue consumer.
// Uses the service-role key; never expose to the browser.
// Tech debt: replace with SECURITY DEFINER RPC post-MVP (TAB-13).
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "astro:env/server";
import type { Database } from "@/db/database.types";

export function createAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
