import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * DeepSeek's API is OpenAI-compatible, so the same @ai-sdk/openai-compatible
 * client used for the previous provider works unchanged — only the base URL,
 * auth header and model id change.
 */
export function createDeepSeekProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "deepseek",
    baseURL: "https://api.deepseek.com/v1",
    supportsStructuredOutputs: true,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

/**
 * No verified model id for "DeepSeek V4-Pro" was available when this was
 * wired up, so there is no hardcoded default: set DEEPSEEK_MODEL in .env to
 * the exact id from your DeepSeek dashboard/docs (e.g. "deepseek-chat" or
 * "deepseek-reasoner" are the ids documented as of early 2026 — confirm
 * against your account before relying on it).
 */
export const SIGNAL_MODEL = process.env["DEEPSEEK_MODEL"] ?? "";
