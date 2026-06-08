import { USE_FIRECRAWL_MOCK, USE_LLM_MOCK } from "astro:env/server";

export const isFirecrawlMockMode = (): boolean => USE_FIRECRAWL_MOCK === "true";
export const isLlmMockMode = (): boolean => USE_LLM_MOCK === "true";
