import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock openai module so createClient() doesn't make real connections
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      apiKey: string;
      baseURL: string;
      timeout: number;
      maxRetries: number;
      constructor(opts: { apiKey?: string; baseURL?: string; timeout?: number; maxRetries?: number }) {
        this.apiKey = opts.apiKey || "";
        this.baseURL = opts.baseURL || "";
        this.timeout = opts.timeout || 0;
        this.maxRetries = opts.maxRetries || 0;
      }
    },
  };
});

import { getProvider } from "../llm-provider";
import type { LLMProvider } from "../llm-provider";

describe("llm-provider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset relevant env vars before each test
    delete process.env.LLM_PROVIDER;
    delete process.env.MINIMAX_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe("getProvider()", () => {
    it("returns MiniMax provider by default when LLM_PROVIDER is not set", () => {
      const provider = getProvider();
      expect(provider.name).toBe("minimax");
      expect(provider.defaultModel).toBe("MiniMax-M2.5");
      expect(provider.supportsToolCalling).toBe(true);
    });

    it("returns MiniMax provider when LLM_PROVIDER is 'minimax'", () => {
      process.env.LLM_PROVIDER = "minimax";
      const provider = getProvider();
      expect(provider.name).toBe("minimax");
      expect(provider.defaultModel).toBe("MiniMax-M2.5");
      expect(provider.apiKeyEnvVar).toBe("MINIMAX_API_KEY");
    });

    it("returns OpenAI provider when LLM_PROVIDER is 'openai'", () => {
      process.env.LLM_PROVIDER = "openai";
      const provider = getProvider();
      expect(provider.name).toBe("openai");
      expect(provider.defaultModel).toBe("gpt-4o-mini");
      expect(provider.supportsToolCalling).toBe(true);
      expect(provider.apiKeyEnvVar).toBe("OPENAI_API_KEY");
    });

    it("returns DeepSeek provider when LLM_PROVIDER is 'deepseek'", () => {
      process.env.LLM_PROVIDER = "deepseek";
      const provider = getProvider();
      expect(provider.name).toBe("deepseek");
      expect(provider.defaultModel).toBe("deepseek-chat");
      expect(provider.supportsToolCalling).toBe(true);
      expect(provider.apiKeyEnvVar).toBe("DEEPSEEK_API_KEY");
    });

    it("is case-insensitive for provider names", () => {
      process.env.LLM_PROVIDER = "OpenAI";
      const provider = getProvider();
      expect(provider.name).toBe("openai");

      process.env.LLM_PROVIDER = "DEEPSEEK";
      const provider2 = getProvider();
      expect(provider2.name).toBe("deepseek");

      process.env.LLM_PROVIDER = "MiniMax";
      const provider3 = getProvider();
      expect(provider3.name).toBe("minimax");
    });

    it("throws a clear error for unsupported provider names", () => {
      process.env.LLM_PROVIDER = "anthropic";
      expect(() => getProvider()).toThrow(
        'Unsupported LLM provider: "anthropic". Supported providers: minimax, openai, deepseek'
      );
    });

    it("throws a descriptive error listing all supported providers", () => {
      process.env.LLM_PROVIDER = "grok";
      try {
        getProvider();
        expect.unreachable("Should have thrown");
      } catch (err) {
        const msg = (err as Error).message;
        expect(msg).toContain("grok");
        expect(msg).toContain("minimax");
        expect(msg).toContain("openai");
        expect(msg).toContain("deepseek");
      }
    });

    it("defaults to minimax when LLM_PROVIDER is empty string", () => {
      process.env.LLM_PROVIDER = "";
      const provider = getProvider();
      expect(provider.name).toBe("minimax");
    });
  });

  describe("provider.createClient()", () => {
    it("MiniMax provider creates a client with correct baseURL", () => {
      process.env.MINIMAX_API_KEY = "test-minimax-key";
      const provider = getProvider();
      const client = provider.createClient();
      expect(client).toBeDefined();
      expect((client as unknown as { baseURL: string }).baseURL).toBe(
        "https://api.minimaxi.com/v1"
      );
      expect((client as unknown as { apiKey: string }).apiKey).toBe(
        "test-minimax-key"
      );
    });

    it("OpenAI provider creates a client with correct baseURL", () => {
      process.env.LLM_PROVIDER = "openai";
      process.env.OPENAI_API_KEY = "test-openai-key";
      const provider = getProvider();
      const client = provider.createClient();
      expect(client).toBeDefined();
      expect((client as unknown as { baseURL: string }).baseURL).toBe(
        "https://api.openai.com/v1"
      );
      expect((client as unknown as { apiKey: string }).apiKey).toBe(
        "test-openai-key"
      );
    });

    it("DeepSeek provider creates a client with correct baseURL", () => {
      process.env.LLM_PROVIDER = "deepseek";
      process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
      const provider = getProvider();
      const client = provider.createClient();
      expect(client).toBeDefined();
      expect((client as unknown as { baseURL: string }).baseURL).toBe(
        "https://api.deepseek.com"
      );
      expect((client as unknown as { apiKey: string }).apiKey).toBe(
        "test-deepseek-key"
      );
    });

    it("creates a client with empty apiKey when env var is not set", () => {
      delete process.env.MINIMAX_API_KEY;
      const provider = getProvider();
      const client = provider.createClient();
      expect((client as unknown as { apiKey: string }).apiKey).toBe("");
    });

    it("creates clients with consistent timeout and retry settings", () => {
      process.env.MINIMAX_API_KEY = "key";
      process.env.OPENAI_API_KEY = "key";
      process.env.DEEPSEEK_API_KEY = "key";

      for (const name of ["minimax", "openai", "deepseek"]) {
        process.env.LLM_PROVIDER = name;
        const provider = getProvider();
        const client = provider.createClient();
        expect((client as unknown as { timeout: number }).timeout).toBe(60000);
        expect((client as unknown as { maxRetries: number }).maxRetries).toBe(2);
      }
    });
  });

  describe("LLMProvider interface contract", () => {
    const providerNames = ["minimax", "openai", "deepseek"];

    it.each(providerNames)(
      "%s provider implements all required interface properties",
      (name) => {
        process.env.LLM_PROVIDER = name;
        process.env.MINIMAX_API_KEY = "key";
        process.env.OPENAI_API_KEY = "key";
        process.env.DEEPSEEK_API_KEY = "key";

        const provider: LLMProvider = getProvider();
        expect(typeof provider.name).toBe("string");
        expect(provider.name.length).toBeGreaterThan(0);
        expect(typeof provider.createClient).toBe("function");
        expect(typeof provider.defaultModel).toBe("string");
        expect(provider.defaultModel.length).toBeGreaterThan(0);
        expect(typeof provider.supportsToolCalling).toBe("boolean");
        expect(typeof provider.apiKeyEnvVar).toBe("string");
        expect(provider.apiKeyEnvVar.length).toBeGreaterThan(0);
      }
    );

    it("each provider has a unique name", () => {
      const names = providerNames.map((n) => {
        process.env.LLM_PROVIDER = n;
        return getProvider().name;
      });
      expect(new Set(names).size).toBe(names.length);
    });

    it("each provider has a unique defaultModel", () => {
      const models = providerNames.map((n) => {
        process.env.LLM_PROVIDER = n;
        return getProvider().defaultModel;
      });
      expect(new Set(models).size).toBe(models.length);
    });
  });
});
