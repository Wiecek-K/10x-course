#!/usr/bin/env bun
/**
 * Standalone Bun script — runs outside the CF Worker, hits real APIs,
 * and writes responses to __fixtures__/ for local mock-mode development.
 *
 * Usage:
 *   bun run scripts/record-fixtures.ts [article-url]
 *
 * Reads FIRECRAWL_API_KEY and LLM_API_KEY from .dev.vars (or env).
 * After running, commit the updated fixture files to share with the team.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../src/lib/services/__fixtures__");

function loadDevVars(): Record<string, string> {
  let content = "";
  try {
    content = readFileSync(".dev.vars", "utf8");
  } catch {
    // no .dev.vars — fall back to process.env only
  }
  const entries = content
    .split("\n")
    .filter((line: string) => line.includes("=") && !line.startsWith("#"))
    .map((line: string): [string, string] => {
      const eqIdx = line.indexOf("=");
      return [line.slice(0, eqIdx).trim(), line.slice(eqIdx + 1).trim()];
    });
  return Object.fromEntries(entries) as Record<string, string>;
}

async function recordFirecrawl(url: string, apiKey: string): Promise<string> {
  console.log(`[firecrawl] Scraping: ${url}`);
  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"] }),
  });

  if (!response.ok) {
    throw new Error(`Firecrawl ${response.status.toString()}: ${await response.text()}`);
  }

  const raw: unknown = await response.json();
  const data = raw as { data: { markdown: string } };
  const markdown = data?.data?.markdown;
  if (!markdown) throw new Error("Empty markdown in Firecrawl response");

  writeFileSync(join(FIXTURES_DIR, "firecrawl-response.md"), markdown);
  console.log("✓ firecrawl-response.md written");
  return markdown;
}

async function recordDescribe(content: string, apiKey: string, sourceUrl: string): Promise<void> {
  console.log("[openai] Generating description...");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content: `You write one-to-two sentence micro-descriptions of saved links in a consistent house style. Match the structure, length, and tone of these examples:
- "A deep dive into how Cloudflare Workers handles cold starts, showing measured latency improvements over traditional serverless with practical deployment patterns."
- "Explores the tension between prompt engineering and fine-tuning for LLM applications, with a cost-accuracy framework for choosing the right approach."
- "Practical guide to Postgres row-level security: how to write policies that are both correct and fast, with common anti-patterns to avoid."`,
        },
        {
          role: "user",
          content: `Summarize the following content in that same style:\n\n${content.slice(0, 6000)}`,
        },
      ],
    }),
  });

  const status = response.status;
  if (!response.ok) {
    throw new Error(`OpenAI ${status.toString()}: ${await response.text()}`);
  }

  const raw: unknown = await response.json();
  const data = raw as { choices: { message: { content: string } }[] };
  const description = data?.choices?.[0]?.message?.content?.trim();
  if (!description) throw new Error("Empty description in OpenAI response");

  // flat fixture — consumed by isMockMode() path in describe.ts
  writeFileSync(join(FIXTURES_DIR, "describe-response.txt"), description);
  console.log("✓ describe-response.txt written");

  // per-URL raw JSON fixture — mirrors Firecrawl structure for test/debug use
  const describeDir = join(FIXTURES_DIR, "describe");
  mkdirSync(describeDir, { recursive: true });
  const slug = new URL(sourceUrl).hostname
    .replace(/^www\./, "")
    .concat(new URL(sourceUrl).pathname)
    .replace(/\/+$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase();
  const rawFixture = JSON.stringify({ status, body: raw }, null, 2);
  writeFileSync(join(describeDir, `${slug}.json`), rawFixture);
  console.log(`✓ describe/${slug}.json written`);
}

async function main(): Promise<void> {
  const vars = loadDevVars();
  const firecrawlKey = (vars["FIRECRAWL_API_KEY"] ?? process.env["FIRECRAWL_API_KEY"]) ?? "";
  const llmKey = (vars["LLM_API_KEY"] ?? process.env["LLM_API_KEY"]) ?? "";
  const sampleUrl = process.argv[2] ?? "https://blog.cloudflare.com/workers-ai/";

  if (!firecrawlKey) {
    console.error("FIRECRAWL_API_KEY not found in .dev.vars or environment");
    process.exit(1);
  }

  const markdown = await recordFirecrawl(sampleUrl, firecrawlKey);

  if (!llmKey) {
    console.warn("LLM_API_KEY not set — skipping describe fixture");
    return;
  }

  await recordDescribe(markdown, llmKey, sampleUrl);
  console.log("\nAll fixtures recorded. Commit src/lib/services/__fixtures__/ to share with the team.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
