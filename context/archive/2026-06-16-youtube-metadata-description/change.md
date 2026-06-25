---
change_id: youtube-metadata-description
title: YouTube interim description from URL metadata (title + channel)
status: archived
created: 2026-06-16
updated: 2026-06-25
archived_at: 2026-06-25T01:17:45Z
---

## Notes

Interim refinement of S-02 (roadmap S-02a). Replace the static YouTube placeholder
`"YouTube video — transcript coming soon."` with a richer micro-description built from URL
metadata: video title + author channel name. No Firecrawl, no LLM — same lightweight OG/metadata
technique sketched for the parked `music.youtube.com` item. Keep a placeholder noting full
transcript is still in progress. Only seam: the YouTube branch in `src/worker.ts:44-51`. Do NOT
touch `isYouTubeUrl()` (`music.youtube.com → false` stays correct). Metadata source (YouTube oEmbed
vs OG `<meta>`) and exact description format to be decided in /10x-plan. Full transcript provider
(Supadata vs TranscriptAPI) remains parked.
