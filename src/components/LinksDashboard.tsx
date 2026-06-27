import { useState } from "react";
import { useLinks } from "@/components/hooks/useLinks";
import { useLinkActions } from "@/components/hooks/useLinkActions";
import InboxList from "@/components/InboxList";
import LibraryList from "@/components/LibraryList";
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
        <LibraryList links={libraryLinks} actions={actions} onEdit={setEditingLink} />
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
