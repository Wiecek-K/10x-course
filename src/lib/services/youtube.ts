interface OEmbedResponse {
  title?: string;
  author_name?: string;
}

function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }
    if (host === "youtube.com") {
      if (parsed.pathname.startsWith("/watch")) {
        return parsed.searchParams.get("v");
      }
      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.slice("/shorts/".length) || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchYouTubeMetadata(url: string): Promise<{ title: string; channel: string } | null> {
  try {
    const id = extractVideoId(url);
    if (!id) return null;
    const watchUrl = `https://www.youtube.com/watch?v=${id}`;
    const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
    const response = await fetch(oEmbedUrl);
    if (!response.ok) return null;
    const raw: unknown = await response.json();
    const data = raw as OEmbedResponse;
    if (!data.title || !data.author_name) return null;
    return { title: data.title, channel: data.author_name };
  } catch {
    return null;
  }
}

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
