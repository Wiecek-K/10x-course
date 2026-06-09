import { cn } from "@/lib/utils";
import { useLinks } from "@/components/hooks/useLinks";
import type { Link } from "@/types";

interface Props {
  initialLinks: Link[];
  userId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

// Defense-in-depth: only ever bind http(s) URLs to href, regardless of writer.
function safeHref(url: string): string {
  return url.startsWith("http://") || url.startsWith("https://") ? url : "#";
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diffMs / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (secs < 60) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function InboxList({ initialLinks, userId, supabaseUrl, supabaseAnonKey }: Props) {
  const links = useLinks(initialLinks, userId, supabaseUrl, supabaseAnonKey);

  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-white/50">Your inbox is empty</p>
        <p className="mt-1 text-sm text-white/30">Send a link to your bot to get started</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {links.map((link) => (
        <li
          key={link.id}
          className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <a
              href={safeHref(link.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-sm text-blue-300 hover:text-blue-100 hover:underline"
            >
              {link.url}
            </a>
            {link.micro_description && <p className="mt-1 text-xs text-white/60">{link.micro_description}</p>}
            <span className="mt-0.5 block text-xs text-white/40">{formatRelativeTime(link.created_at)}</span>
          </div>
          {(link.processing_status === "pending" ||
            link.processing_status === "scraping" ||
            link.processing_status === "describing") && (
            <span
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                link.processing_status === "pending"
                  ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-300"
                  : "border-blue-400/30 bg-blue-400/10 text-blue-300",
              )}
            >
              {link.processing_status === "pending" ? "pending" : "processing"}
            </span>
          )}
          {link.processing_status === "failed" && (
            <span
              className={cn(
                "shrink-0 rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-xs font-medium text-red-300",
              )}
            >
              failed
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
