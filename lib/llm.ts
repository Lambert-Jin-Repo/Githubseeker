import OpenAI from "openai";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { webSearch, fetchWebPage, fetchGitHubMetadata } from "./web-search";
import { getProvider } from "./llm-provider";
import { logLLMCall } from "./api-logger";

const provider = getProvider();
const MODEL = provider.defaultModel;

// Lazy-initialized client to avoid side effects at module import time
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = provider.createClient();
  }
  return _client;
}

const SCOUT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for information. Use for discovering GitHub repos and finding articles.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          count: {
            type: "number",
            description: "Number of results (default 10)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_fetch",
      description:
        "Fetch a web page. For top-level GitHub repo URLs (github.com/owner/repo), returns structured JSON with stars, language, license, description, topics, and last commit. For other URLs, returns raw HTML.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to fetch" },
        },
        required: ["url"],
      },
    },
  },
];

export interface LLMCallOptions {
  systemPrompt: string;
  userMessage: string;
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
  onToolResult?: (toolName: string, result: string) => void;
  onToolError?: (toolName: string, error: Error) => void;
  maxToolRounds?: number;
  signal?: AbortSignal;
  searchId?: string;
  operation?: string;
}

export async function callLLMWithTools(
  options: LLMCallOptions
): Promise<string> {
  const {
    systemPrompt,
    userMessage,
    onToolCall,
    onToolResult,
    onToolError,
    maxToolRounds = 10,
    signal,
    searchId,
    operation,
  } = options;

  const providerName = provider.name;
  const operationName = operation || "llm_call";

  // Closure over searchId so tool calls can pass it to web-search functions
  async function executeToolCall(
    name: string,
    args: Record<string, unknown>
  ): Promise<string> {
    switch (name) {
      case "web_search": {
        const results = searchId
          ? await webSearch(args.query as string, (args.count as number) || 10, searchId)
          : await webSearch(args.query as string, (args.count as number) || 10);
        return JSON.stringify(results);
      }
      case "web_fetch": {
        const url = args.url as string;
        // Route top-level GitHub repo URLs through metadata extraction (~300B vs 50KB)
        if (/^https?:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(url)) {
          const meta = searchId
            ? await fetchGitHubMetadata(url, searchId)
            : await fetchGitHubMetadata(url);
          return JSON.stringify(meta);
        }
        const content = searchId
          ? await fetchWebPage(url, searchId)
          : await fetchWebPage(url);
        return content;
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  // Pure completion mode — no tools, no exhaustion message
  if (maxToolRounds === 0) {
    const startTime = performance.now();
    try {
      const response = await getClient().chat.completions.create({
        model: MODEL,
        max_tokens: 16384,
        messages,
      });
      const latencyMs = Math.round(performance.now() - startTime);
      if (searchId) {
        logLLMCall({
          search_id: searchId,
          provider: providerName,
          model: MODEL,
          operation: operationName,
          success: true,
          latency_ms: latencyMs,
          tokens_in: response.usage?.prompt_tokens ?? 0,
          tokens_out: response.usage?.completion_tokens ?? 0,
        });
      }
      return response.choices[0]?.message?.content || "";
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startTime);
      if (searchId) {
        logLLMCall({
          search_id: searchId,
          provider: providerName,
          model: MODEL,
          operation: operationName,
          success: false,
          latency_ms: latencyMs,
          tokens_in: 0,
          tokens_out: 0,
          error_type: err instanceof Error ? err.message : "unknown",
        });
      }
      throw err;
    }
  }

  for (let round = 0; round < maxToolRounds; round++) {
    if (signal?.aborted) {
      return messages[messages.length - 1]?.role === "assistant"
        ? (messages[messages.length - 1] as { content?: string }).content || ""
        : "";
    }

    const startTime = performance.now();
    let response: OpenAI.ChatCompletion;
    try {
      response = await getClient().chat.completions.create({
        model: MODEL,
        max_tokens: 16384,
        messages,
        tools: SCOUT_TOOLS,
        tool_choice: "auto",
      });
      const latencyMs = Math.round(performance.now() - startTime);
      if (searchId) {
        logLLMCall({
          search_id: searchId,
          provider: providerName,
          model: MODEL,
          operation: operationName,
          success: true,
          latency_ms: latencyMs,
          tokens_in: response.usage?.prompt_tokens ?? 0,
          tokens_out: response.usage?.completion_tokens ?? 0,
          tool_round: round + 1,
        });
      }
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startTime);
      if (searchId) {
        logLLMCall({
          search_id: searchId,
          provider: providerName,
          model: MODEL,
          operation: operationName,
          success: false,
          latency_ms: latencyMs,
          tokens_in: 0,
          tokens_out: 0,
          error_type: err instanceof Error ? err.message : "unknown",
          tool_round: round + 1,
        });
      }
      throw err;
    }

    const choice = response.choices[0];
    if (!choice) {
      return "";
    }
    const message = choice.message;
    messages.push(message);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content || "";
    }

    // Execute all tool calls in parallel for concurrency
    const functionCalls = message.tool_calls.filter(tc => tc.type === "function");
    for (const tc of functionCalls) {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }
      onToolCall?.(tc.function.name, args);
    }

    if (signal?.aborted) {
      return message.content || "";
    }

    const results = await Promise.allSettled(
      functionCalls.map(async (tc) => {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = {};
        }
        try {
          return await executeToolCall(tc.function.name, args);
        } catch (err) {
          const toolError = err instanceof Error ? err : new Error("Tool execution failed");
          onToolError?.(tc.function.name, toolError);
          return JSON.stringify({ error: toolError.message });
        }
      })
    );

    // Push tool results in order, preserving message sequence
    for (let i = 0; i < functionCalls.length; i++) {
      const tc = functionCalls[i];
      const settled = results[i];
      const result = settled.status === "fulfilled"
        ? settled.value
        : JSON.stringify({ error: "Tool execution failed" });
      onToolResult?.(tc.function.name, result);
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  // Max tool rounds exhausted — ask the LLM for its final JSON answer without tools
  messages.push({
    role: "user",
    content: "You have used all available tool calls. Based on the information gathered so far, return your final structured JSON response now. Do NOT use any more tools. Return ONLY the JSON object.",
  });

  const exhaustedStartTime = performance.now();
  try {
    const finalResponse = await getClient().chat.completions.create({
      model: MODEL,
      max_tokens: 16384,
      messages,
    });
    const latencyMs = Math.round(performance.now() - exhaustedStartTime);
    if (searchId) {
      logLLMCall({
        search_id: searchId,
        provider: providerName,
        model: MODEL,
        operation: operationName,
        success: true,
        latency_ms: latencyMs,
        tokens_in: finalResponse.usage?.prompt_tokens ?? 0,
        tokens_out: finalResponse.usage?.completion_tokens ?? 0,
        metadata: { exhausted: true },
      });
    }
    return finalResponse.choices[0]?.message?.content || "";
  } catch (err) {
    const latencyMs = Math.round(performance.now() - exhaustedStartTime);
    if (searchId) {
      logLLMCall({
        search_id: searchId,
        provider: providerName,
        model: MODEL,
        operation: operationName,
        success: false,
        latency_ms: latencyMs,
        tokens_in: 0,
        tokens_out: 0,
        error_type: err instanceof Error ? err.message : "unknown",
        metadata: { exhausted: true },
      });
    }
    throw err;
  }
}

export { SCOUT_TOOLS };
/** Lazy-initialized OpenAI client. Prefer using callLLMWithTools instead. */
export { getClient as client };
