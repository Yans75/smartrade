import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * DeepSeek's API is OpenAI-compatible, so the same @ai-sdk/openai-compatible
 * client used for the previous provider works unchanged — only the base URL,
 * auth header and model id change.
 *
 * Base URL confirmed against DeepSeek's own "Models & Pricing" page
 * (api-docs.deepseek.com/quick_start/pricing): "https://api.deepseek.com",
 * no /v1 suffix — the OpenAI-compatible client appends /chat/completions
 * itself, it does not add /v1.
 *
 * supportsStructuredOutputs must stay false: set to true it makes the SDK
 * send OpenAI's strict `response_format: {type: "json_schema", ...}`, which
 * DeepSeek rejected in production with "This response_format type is
 * unavailable now". DeepSeek's own docs list "Json Output" support (the
 * older `json_object` mode) and "Tool Calls", not the strict json_schema
 * mode — with this false, the AI SDK falls back to tool-calling to get the
 * structured signal object, which DeepSeek does support.
 */
export function createDeepSeekProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "deepseek",
    baseURL: "https://api.deepseek.com",
    supportsStructuredOutputs: false,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

/**
 * "deepseek-v4-pro" — confirmed against DeepSeek's Models & Pricing page.
 * JSON Output and Tool Calls are both supported on this model, which is what
 * the structured signal output (Output.object) relies on.
 */
export const SIGNAL_MODEL = process.env["DEEPSEEK_MODEL"] ?? "deepseek-v4-pro";
