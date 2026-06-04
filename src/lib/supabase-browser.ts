import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/db/database.types";

export function createBrowserSupabaseClient(supabaseUrl: string, supabaseAnonKey: string) {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
