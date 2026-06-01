declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
  }
}

declare namespace Cloudflare {
  interface Env {
    LINK_QUEUE: Queue<import("@/types").QueueMessage>;
  }
}
