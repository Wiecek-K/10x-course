export function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return true;
    if (host === "youtube.com") {
      return parsed.pathname.startsWith("/watch") || parsed.pathname.startsWith("/shorts/");
    }
    return false;
  } catch {
    return false;
  }
}
