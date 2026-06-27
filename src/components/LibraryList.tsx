import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

function RemoveConfirmButton({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 px-2 text-xs text-red-400/70 hover:bg-red-400/10 hover:text-red-400")}
        >
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-white/10 bg-gray-900 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove from library?</AlertDialogTitle>
          <AlertDialogDescription className="text-white/50">
            This will permanently delete the link. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-white/10 text-white hover:bg-white/10">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={() => {
              onConfirm();
            }}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function LibraryList({ links, actions, onEdit }: Props) {
  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-white/50">Your library is empty</p>
        <p className="mt-1 text-sm text-white/30">Keep links from your inbox to build your library</p>
      </div>
    );
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
            >
              {link.url}
            </a>
            {link.micro_description && <p className="mt-1 text-xs text-white/60">{link.micro_description}</p>}
            {link.note && <p className="mt-1 text-xs text-white/40 italic">{link.note}</p>}
            <span className="mt-0.5 block text-xs text-white/40">{formatRelativeTime(link.created_at)}</span>
          </div>

          <div className="flex items-center gap-1">
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
            <RemoveConfirmButton
              onConfirm={() => {
                void actions.removeImmediately(link.id);
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
