import { useState, useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { Link } from "@/types";

export function useLinks(initialLinks: Link[], userId: string, supabaseUrl: string, supabaseAnonKey: string) {
  const [links, setLinks] = useState<Link[]>(initialLinks);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient(supabaseUrl, supabaseAnonKey);
    const channel = supabase
      .channel("inbox-inserts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "links",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setLinks((prev) => [payload.new as Link, ...prev]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, supabaseUrl, supabaseAnonKey]);

  return links;
}
