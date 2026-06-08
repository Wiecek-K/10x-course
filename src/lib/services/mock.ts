import { USE_API_MOCKS } from "astro:env/server";

export const isMockMode = (): boolean => USE_API_MOCKS === "true";
