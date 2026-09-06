import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Link } from "@/types";

interface Props {
  link: Link | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, fields: { url?: string; micro_description?: string | null; note?: string | null }) => void;
}

function EditLinkForm({
  link,
  onOpenChange,
  onSave,
}: {
  link: Link;
  onOpenChange: (open: boolean) => void;
  onSave: Props["onSave"];
}) {
  const [url, setUrl] = useState(link.url);
  const [microDescription, setMicroDescription] = useState(link.micro_description ?? "");
  const [note, setNote] = useState(link.note ?? "");
  const [urlError, setUrlError] = useState("");

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();

    const trimmedUrl = url.trim();
    if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
      setUrlError("URL must start with http:// or https://");
      return;
    }

    onSave(link.id, {
      url: trimmedUrl,
      micro_description: microDescription.trim() || null,
      note: note.trim() || null,
    });
    onOpenChange(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="edit-url" className="mb-1 block text-sm text-white/70">
          URL
        </label>
        <input
          id="edit-url"
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setUrlError("");
          }}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-blue-400 focus:outline-none"
        />
        {urlError && <p className="mt-1 text-xs text-red-400">{urlError}</p>}
      </div>
      <div>
        <label htmlFor="edit-description" className="mb-1 block text-sm text-white/70">
          Description
        </label>
        <input
          id="edit-description"
          type="text"
          value={microDescription}
          onChange={(e) => {
            setMicroDescription(e.target.value);
          }}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-blue-400 focus:outline-none"
          placeholder="Short description"
        />
      </div>
      <div>
        <label htmlFor="edit-note" className="mb-1 block text-sm text-white/70">
          Note
        </label>
        <textarea
          id="edit-note"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
          }}
          rows={3}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-blue-400 focus:outline-none"
          placeholder="Personal note"
        />
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onOpenChange(false);
          }}
          className="border-white/10"
        >
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  );
}

export default function EditLinkDialog({ link, open, onOpenChange, onSave }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-gray-900 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit link</DialogTitle>
          <DialogDescription className="text-white/50">Update the link details below.</DialogDescription>
        </DialogHeader>
        {link && <EditLinkForm key={link.id} link={link} onOpenChange={onOpenChange} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}
