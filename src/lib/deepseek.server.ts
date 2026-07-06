import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { envValue, requiredEnv } from "./env.server";

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_DEFAULT_MODEL = envValue("DEEPSEEK_MODEL") ?? "deepseek-v4-flash";

function getDeepSeekApiKey() {
  return requiredEnv("DeepSeek AI", "DEEPSEEK_API_KEY");
}

export function createDeepSeekProvider() {
  const apiKey = getDeepSeekApiKey();
  return createOpenAICompatible({
    name: "deepseek",
    baseURL: DEEPSEEK_BASE_URL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export type DeepSeekChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
};

export type DeepSeekChatCompletionOptions = {
  model?: string;
  messages: DeepSeekChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" | "text" };
  signal?: AbortSignal;
  retries?: number;
};

export async function createDeepSeekChatCompletion({
  model = DEEPSEEK_DEFAULT_MODEL,
  messages,
  temperature = 0.3,
  max_tokens = 700,
  response_format,
  signal,
  retries = 1,
}: DeepSeekChatCompletionOptions) {
  const apiKey = getDeepSeekApiKey();
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens,
          thinking: { type: "disabled" },
          ...(response_format ? { response_format } : {}),
        }),
        signal: signal ?? AbortSignal.timeout(20_000),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        const detail =
          typeof json?.error?.message === "string" ? json.error.message : `HTTP ${res.status}`;
        throw new Error(`DeepSeek request gagal: ${detail}`);
      }
      return json as {
        choices?: Array<{ message?: { content?: string | null } }>;
        usage?: unknown;
      };
    } catch (err) {
      lastError = err;
      if (attempt >= retries) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("DeepSeek request gagal.");
}

export function getDeepSeekModel(model = DEEPSEEK_DEFAULT_MODEL) {
  return createDeepSeekProvider()(model);
}
