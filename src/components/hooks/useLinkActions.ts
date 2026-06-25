import { useRef, useEffect, useCallback } from "react";
import type { Link } from "@/types";

interface PendingDelete {
  link: Link;
  timer: ReturnType<typeof setTimeout>;
}

interface UseLinkActionsOptions {
  links: Link[];
  updateLink: (id: string, fields: Partial<Link>) => void;
  removeLink: (id: string) => void;
  restoreLink: (link: Link) => void;
}

export function useLinkActions({ links, updateLink, removeLink, restoreLink }: UseLinkActionsOptions) {
  const pendingDeletes = useRef<Map<string, PendingDelete>>(new Map());
  const linksRef = useRef(links);

  useEffect(() => {
    linksRef.current = links;
  }, [links]);

  useEffect(() => {
    const pending = pendingDeletes.current;
    return () => {
      for (const [, entry] of pending) {
        clearTimeout(entry.timer);
        void fetch(`/api/links/${entry.link.id}`, { method: "DELETE" });
      }
      pending.clear();
    };
  }, []);

  const keepInLibrary = useCallback(
    async (id: string) => {
      updateLink(id, { in_library: true });
      const res = await fetch(`/api/links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ in_library: true }),
      });
      if (!res.ok) {
        updateLink(id, { in_library: false });
        throw new Error("Failed to keep in library");
      }
    },
    [updateLink],
  );

  const editLink = useCallback(
    async (id: string, fields: { url?: string; micro_description?: string | null; note?: string | null }) => {
      const prev = linksRef.current.find((l) => l.id === id);
      if (!prev) return;
      updateLink(id, fields);
      const res = await fetch(`/api/links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        updateLink(id, { url: prev.url, micro_description: prev.micro_description, note: prev.note });
        throw new Error("Failed to edit link");
      }
    },
    [updateLink],
  );

  const markVisited = useCallback((id: string) => {
    void fetch(`/api/links/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visited: true }),
    });
  }, []);

  const removeImmediately = useCallback(
    async (id: string) => {
      const prev = linksRef.current.find((l) => l.id === id);
      removeLink(id);
      const res = await fetch(`/api/links/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        if (prev) restoreLink(prev);
        throw new Error("Failed to delete link");
      }
    },
    [removeLink, restoreLink],
  );

  const removeWithUndo = useCallback(
    (id: string) => {
      const existing = pendingDeletes.current.get(id);
      if (existing) {
        clearTimeout(existing.timer);
        pendingDeletes.current.delete(id);
      }

      const link = linksRef.current.find((l) => l.id === id);
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- noop undo when link not found
      if (!link) return { undo: () => {} };

      removeLink(id);

      const timer = setTimeout(() => {
        pendingDeletes.current.delete(id);
        void fetch(`/api/links/${id}`, { method: "DELETE" });
      }, 5000);

      pendingDeletes.current.set(id, { link, timer });

      const undo = () => {
        const entry = pendingDeletes.current.get(id);
        if (entry) {
          clearTimeout(entry.timer);
          pendingDeletes.current.delete(id);
          restoreLink(entry.link);
        }
      };

      return { undo };
    },
    [removeLink, restoreLink],
  );

  return { keepInLibrary, editLink, markVisited, removeImmediately, removeWithUndo };
}
