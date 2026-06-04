import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  email: string;
  connected: boolean;
}

type PairingState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "active"; deepLink: string; expiresAt: string }
  | { status: "expired" };

function computeCountdown(expiresAt: string): string {
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  if (msLeft <= 0) return "0:00";
  const totalSecs = Math.floor(msLeft / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function AccountMenu({ email, connected }: Props) {
  const [open, setOpen] = useState(false);
  const [pairing, setPairing] = useState<PairingState>({ status: "idle" });
  const [countdown, setCountdown] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  useEffect(() => {
    if (pairing.status !== "active") return;
    const expiresAt = pairing.expiresAt;
    const id = setInterval(() => {
      const msLeft = new Date(expiresAt).getTime() - Date.now();
      if (msLeft <= 0) {
        clearInterval(id);
        setPairing({ status: "expired" });
        return;
      }
      const totalSecs = Math.floor(msLeft / 1000);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      setCountdown(`${mins}:${secs.toString().padStart(2, "0")}`);
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [pairing]);

  async function requestPairingLink() {
    setPairing({ status: "loading" });
    try {
      const res = await fetch("/api/pairing", { method: "POST" });
      if (!res.ok) {
        setPairing({ status: "idle" });
        return;
      }
      const responseData: unknown = await res.json();
      const data = responseData as { deepLink: string; expiresAt: string };
      setCountdown(computeCountdown(data.expiresAt));
      setPairing({ status: "active", deepLink: data.deepLink, expiresAt: data.expiresAt });
    } catch {
      setPairing({ status: "idle" });
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => {
          setOpen((v) => !v);
        }}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/20",
        )}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/40 text-xs font-semibold">
          {email.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-[140px] truncate sm:block">{email}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-72 rounded-xl border border-white/10 bg-slate-900/95 p-4 shadow-xl backdrop-blur-xl">
          <p className="truncate text-xs text-white/50">{email}</p>

          <form method="POST" action="/api/auth/signout" className="mt-3 border-t border-white/10 pt-3">
            <button
              type="submit"
              className="w-full rounded-md px-3 py-1.5 text-left text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </form>

          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="mb-2 text-xs font-medium tracking-wide text-white/50 uppercase">Telegram</p>

            {connected ? (
              <p className="text-sm text-green-400">Connected ✅</p>
            ) : pairing.status === "idle" ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10"
                onClick={requestPairingLink}
              >
                Connect Telegram
              </Button>
            ) : pairing.status === "loading" ? (
              <p className="text-sm text-white/40">Generating link…</p>
            ) : pairing.status === "expired" ? (
              <div className="space-y-2">
                <p className="text-xs text-white/40">Link expired</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10"
                  onClick={requestPairingLink}
                >
                  Generate new link
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <a
                  href={pairing.deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate rounded-md bg-blue-600/20 px-3 py-2 text-sm text-blue-300 hover:bg-blue-600/30 hover:text-blue-100"
                >
                  Open in Telegram →
                </a>
                <p className="text-xs text-white/40">Expires in {countdown}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
