// Style reference for the micro-description prompt.
// Future: replace with per-user examples from user_settings when BYOK + style customisation ships.
export const DESCRIBE_EXAMPLES = [
  "Explains how Postgres VACUUM reclaims dead tuple storage, covers autovacuum threshold tuning for high-churn tables, and shows how to read pg_stat_user_tables to diagnose bloat.",
  "Covers the Cloudflare Workers execution model: V8 isolate lifecycle, what triggers a cold start, how the 128 MB memory limit applies per request, and how CPU time is billed.",
  "Describes React Server Components: which rendering runs server-side, where client boundaries split the tree, and how RSC payloads differ from server-rendered HTML.",
  "Details how git stores commits, trees, and blobs as SHA-1-addressed objects, and how packfiles compress history using delta chains against a sliding window of recent objects.",
  "Benchmarks cold start latency across AWS Lambda, Cloudflare Workers, and Fly.io for Node.js, Python, and Rust runtimes under isolated and warm traffic conditions.",
] as const;
