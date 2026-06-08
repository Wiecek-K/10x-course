import describeFixture from "./__fixtures__/describe-response.txt?raw";
import { getLlmApiKey } from "@/lib/llm-key";
import { isLlmMockMode } from "./mock";
import { DESCRIBE_EXAMPLES } from "./describe-examples";

const INPUT_CAP = 6000;

const RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "micro_description",
    strict: true,
    schema: {
      type: "object",
      properties: {
        description: { type: "string" },
      },
      required: ["description"],
      additionalProperties: false,
    },
  },
};

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIChatResponse {
  choices: { message: { content: string | null } }[];
}

interface MicroDescriptionOutput {
  description: string;
}

export async function describeContent(content: string, userId: string): Promise<string | null> {
  if (isLlmMockMode()) {
    return describeFixture.trim() || null;
  }

  const key = getLlmApiKey(userId);
  if (!key) return null;

  const truncated = content.slice(0, INPUT_CAP);

  const messages: OpenAIMessage[] = [
    {
      role: "system",
      content: `You write micro-descriptions of saved links. Write 1-2 sentences. Plain text only — no markdown, no bullet points, no formatting. Match the length and tone of these examples:\n${DESCRIBE_EXAMPLES.join("\n")}`,
    },
    {
      role: "user",
      content: `Write a micro-description for the following content:\n${truncated}`,
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
      body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 120, response_format: RESPONSE_FORMAT }),
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
  const jsonText = data.choices[0]?.message?.content ?? "";
  if (!jsonText) return null;

  const parsed = JSON.parse(jsonText) as MicroDescriptionOutput;
  return parsed.description.trim() || null;
}
