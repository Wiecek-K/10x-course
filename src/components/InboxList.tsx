import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Link } from "@/types";
import type { useLinkActions } from "@/components/hooks/useLinkActions";

interface Props {
  links: Link[];
  actions: ReturnType<typeof useLinkActions>;
  onEdit: (link: Link) => void;
}

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

export default function InboxList({ links, actions, onEdit }: Props) {
  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-white/50">Your inbox is empty</p>
        <p className="mt-1 text-sm text-white/30">Send a link to your bot to get started</p>
      </div>
    );
  }

  function handleRemoveWithUndo(link: Link, label: string) {
    const { undo } = actions.removeWithUndo(link.id);
    toast(`Link ${label}`, {
      action: {
        label: "Undo",
        onClick: () => {
          undo();
        },
      },
      duration: 5000,
    });
  }

  return (
    <ul className="space-y-2">
      {links.map((link) => (
        <li
          key={link.id}
          className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
        >
          <div className="min-w-0 flex-1">
            <a
              href={safeHref(link.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-sm text-blue-300 hover:text-blue-100 hover:underline"
              onClick={() => {
                actions.markVisited(link.id);
              }}
            >
              {link.url}
            </a>
            {link.micro_description && <p className="mt-1 text-xs text-white/60">{link.micro_description}</p>}
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-xs text-white/40">{formatRelativeTime(link.created_at)}</span>
              {link.last_visited && <span className="text-xs text-amber-400/70">opened — awaiting action</span>}
            </div>
          </div>

          <div className="flex items-center gap-1">
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
              <span className="shrink-0 rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-xs font-medium text-red-300">
                failed
              </span>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-green-400 hover:bg-green-400/10 hover:text-green-300"
              onClick={() => {
                void actions.keepInLibrary(link.id);
              }}
            >
              Keep
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-white/50 hover:bg-white/10 hover:text-white/70"
              onClick={() => {
                handleRemoveWithUndo(link, "consumed");
              }}
            >
              Done
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-white/50 hover:bg-white/10 hover:text-white/70"
              onClick={() => {
                handleRemoveWithUndo(link, "discarded");
              }}
            >
              Discard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-white/50 hover:bg-white/10 hover:text-white/70"
              onClick={() => {
                onEdit(link);
              }}
            >
              Edit
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
