import { useState, useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { Link } from "@/types";

export function useLinks(initialLinks: Link[], userId: string, supabaseUrl: string, supabaseAnonKey: string) {
  const [links, setLinks] = useState<Link[]>(initialLinks);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient(supabaseUrl, supabaseAnonKey);
    let channel: RealtimeChannel | undefined;
    const state = { cancelled: false };

    void (async () => {
      // Restore the session from cookies, then attach the user JWT to the
      // Realtime socket BEFORE subscribing — otherwise the channel joins as
      // anon and the links SELECT RLS policy (auth.uid() = user_id) drops
      // every INSERT event while still reporting SUBSCRIBED.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await supabase.realtime.setAuth(session?.access_token);
      if (state.cancelled) return;

      channel = supabase
        .channel("inbox-inserts")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "links", filter: `user_id=eq.${userId}` },
          (payload) => {
            setLinks((prev) => [payload.new as Link, ...prev]);
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "links", filter: `user_id=eq.${userId}` },
          (payload) => {
            setLinks((prev) => prev.map((l) => (l.id === payload.new.id ? (payload.new as Link) : l)));
          },
        )
        .subscribe();
    })();

    return () => {
      state.cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, supabaseUrl, supabaseAnonKey]);

  return links;
}
