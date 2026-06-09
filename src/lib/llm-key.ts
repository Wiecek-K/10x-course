import { LLM_API_KEY } from "astro:env/server";

// MVP: returns global ops-key, ignoring userId.
// Future: read per-user key from user_settings table, fall back to env.
export function getLlmApiKey(_userId: string): string | null {
  return LLM_API_KEY ?? null;
}
