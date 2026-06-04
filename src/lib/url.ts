export function extractFirstUrl(text: string): string | null {
  const match = /https?:\/\/\S+/.exec(text);
  return match ? match[0] : null;
}
