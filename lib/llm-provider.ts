import OpenAI from "openai";

export interface LLMProvider {
  name: string;
  createClient(): OpenAI;
  defaultModel: string;
  supportsToolCalling: boolean;
  /** The env var name that holds the API key for this provider */
  apiKeyEnvVar: string;
}

const minimaxProvider: LLMProvider = {
  name: "minimax",
  apiKeyEnvVar: "MINIMAX_API_KEY",
  createClient() {
    return new OpenAI({
      apiKey: process.env.MINIMAX_API_KEY || "",
      baseURL: "https://api.minimaxi.com/v1",
      timeout: 60000,
      maxRetries: 2,
    });
  },
  defaultModel: "MiniMax-M2.5",
  supportsToolCalling: true,
};

const openaiProvider: LLMProvider = {
  name: "openai",
  apiKeyEnvVar: "OPENAI_API_KEY",
  createClient() {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
      baseURL: "https://api.openai.com/v1",
      timeout: 60000,
      maxRetries: 2,
    });
  },
  defaultModel: "gpt-4o-mini",
  supportsToolCalling: true,
};

const deepseekProvider: LLMProvider = {
  name: "deepseek",
  apiKeyEnvVar: "DEEPSEEK_API_KEY",
  createClient() {
    return new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || "",
      baseURL: "https://api.deepseek.com",
      timeout: 60000,
      maxRetries: 2,
    });
  },
  defaultModel: "deepseek-chat",
  supportsToolCalling: true,
};

const PROVIDERS: Record<string, LLMProvider> = {
  minimax: minimaxProvider,
  openai: openaiProvider,
  deepseek: deepseekProvider,
};

/**
 * Returns the LLM provider based on the `LLM_PROVIDER` env var.
 * Defaults to "minimax" if the env var is not set.
 * Throws if the env var is set to an unsupported provider name.
 */
export function getProvider(): LLMProvider {
  const name = (process.env.LLM_PROVIDER || "minimax").toLowerCase();
  const provider = PROVIDERS[name];
  if (!provider) {
    const supported = Object.keys(PROVIDERS).join(", ");
    throw new Error(
      `Unsupported LLM provider: "${name}". Supported providers: ${supported}`
    );
  }
  return provider;
}
