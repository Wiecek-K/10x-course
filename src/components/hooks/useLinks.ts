import { useState, useEffect, useCallback } from "react";
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await supabase.realtime.setAuth(session?.access_token);
      if (state.cancelled) return;

      channel = supabase
        .channel("links-realtime")
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
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "links", filter: `user_id=eq.${userId}` },
          (payload) => {
            setLinks((prev) => prev.filter((l) => l.id !== payload.old.id));
          },
        )
        .subscribe();
    })();

    return () => {
      state.cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, supabaseUrl, supabaseAnonKey]);

  const updateLink = useCallback((id: string, fields: Partial<Link>) => {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...fields } : l)));
  }, []);

  const removeLink = useCallback((id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const restoreLink = useCallback((link: Link) => {
    setLinks((prev) => {
      if (prev.some((l) => l.id === link.id)) return prev;
      return [link, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });
  }, []);

  return { links, setLinks, updateLink, removeLink, restoreLink };
}
