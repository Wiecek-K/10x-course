import describeFixture from "./__fixtures__/describe-response.txt?raw";
import { getLlmApiKey } from "@/lib/llm-key";
import { isMockMode } from "./mock";

const FEW_SHOT_EXAMPLES = [
  "A deep dive into how Cloudflare Workers handles cold starts, showing measured latency improvements over traditional serverless with practical deployment patterns.",
  "Explores the tension between prompt engineering and fine-tuning for LLM applications, with a cost-accuracy framework for choosing the right approach.",
  "Practical guide to Postgres row-level security: how to write policies that are both correct and fast, with common anti-patterns to avoid.",
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
