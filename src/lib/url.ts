export function extractFirstUrl(text: string): string | null {
  const match = /https?:\/\/\S+/.exec(text);
  if (!match) return null;
  // Trailing punctuation/markdown from share-sheet text isn't part of the URL.
  return match[0].replace(/[.,;:!?)\]}>'"]+$/, "");
}
