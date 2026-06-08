import describeFixture from "./__fixtures__/describe-response.txt?raw";
import { getLlmApiKey } from "@/lib/llm-key";
import { isMockMode } from "./mock";

const FEW_SHOT_EXAMPLES = [
  "Explores how Astro 5's Content Layer API unifies local files and remote data sources into a single typed collection, cutting fetch boilerplate and enabling incremental builds.",
  "Explains how Cloudflare Workers AI runs serverless GPU inference at the edge, listing the curated open-source model catalog and the minimal setup needed to call a model from a Worker.",
  "Covers React 19's new hooks — useActionState, useFormStatus, useOptimistic — and shows how server actions replace manual fetch/state wiring for form submissions.",
];

const INPUT_CAP = 6000;

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIChatResponse {
  choices: { message: { content: string | null } }[];
}

export async function describeContent(content: string, userId: string): Promise<string | null> {
  if (isMockMode()) {
    return describeFixture.trim() || null;
  }

  const key = getLlmApiKey(userId);
  if (!key) return null;

  const truncated = content.slice(0, INPUT_CAP);

  const messages: OpenAIMessage[] = [
    {
      role: "system",
      content: `You write one-to-two sentence micro-descriptions of saved links in a consistent house style. Match the structure, length, and tone of these examples:\n${FEW_SHOT_EXAMPLES.map((e) => `- "${e}"`).join("\n")}`,
    },
    {
      role: "user",
      content: `Summarize the following content in that same style:\n${truncated}`,
    },
  ];

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 120 }),
    });
  } catch (err) {
    throw new Error(`OpenAI network error: ${String(err)}`);
  }

  if (response.status === 429 || response.status >= 500) {
    throw new Error(`OpenAI transient error: ${response.status}`);
  }

  if (!response.ok) return null;

  const raw: unknown = await response.json();
  const data = raw as OpenAIChatResponse;
  const text = data.choices[0]?.message?.content?.trim() ?? "";
  return text || null;
}
