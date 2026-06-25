import { useState } from "react";
import { useLinks } from "@/components/hooks/useLinks";
import { useLinkActions } from "@/components/hooks/useLinkActions";
import InboxList from "@/components/InboxList";
import EditLinkDialog from "@/components/EditLinkDialog";
import { Toaster } from "@/components/ui/sonner";
import type { Link } from "@/types";

interface Props {
  initialLinks: Link[];
  userId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export default function LinksDashboard({ initialLinks, userId, supabaseUrl, supabaseAnonKey }: Props) {
  const { links, updateLink, removeLink, restoreLink } = useLinks(initialLinks, userId, supabaseUrl, supabaseAnonKey);
  const actions = useLinkActions({ links, updateLink, removeLink, restoreLink });
  const [editingLink, setEditingLink] = useState<Link | null>(null);

  const inboxLinks = links.filter((l) => !l.in_library);
  const libraryLinks = links.filter((l) => l.in_library);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Inbox</h2>
        <InboxList links={inboxLinks} actions={actions} onEdit={setEditingLink} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Library</h2>
        {libraryLinks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-white/50">Your library is empty</p>
            <p className="mt-1 text-sm text-white/30">Keep links from your inbox to build your library</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {libraryLinks.map((link) => (
              <li
                key={link.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <a
                    href={link.url.startsWith("http") ? link.url : "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm text-blue-300 hover:text-blue-100 hover:underline"
                  >
                    {link.url}
                  </a>
                  {link.micro_description && <p className="mt-1 text-xs text-white/60">{link.micro_description}</p>}
                  {link.note && <p className="mt-1 text-xs text-white/40 italic">{link.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <EditLinkDialog
        link={editingLink}
        open={editingLink !== null}
        onOpenChange={(open) => {
          if (!open) setEditingLink(null);
        }}
        onSave={actions.editLink}
      />
      <Toaster />
    </div>
  );
}
