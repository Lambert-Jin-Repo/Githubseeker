import OpenAI from "openai";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { webSearch, fetchWebPage, fetchGitHubMetadata } from "./web-search";

const client = new OpenAI({
  apiKey: process.env.MINIMAX_API_KEY!,
  baseURL: "https://api.minimaxi.com/v1",
});

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

async function executeToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "web_search": {
      const results = await webSearch(
        args.query as string,
        (args.count as number) || 10
      );
      return JSON.stringify(results);
    }
    case "web_fetch": {
      const url = args.url as string;
      // Route top-level GitHub repo URLs through metadata extraction (~300B vs 50KB)
      if (/^https?:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(url)) {
        const meta = await fetchGitHubMetadata(url);
        return JSON.stringify(meta);
      }
      const content = await fetchWebPage(url);
      return content;
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export interface LLMCallOptions {
  systemPrompt: string;
  userMessage: string;
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
  onToolResult?: (toolName: string, result: string) => void;
  onToolError?: (toolName: string, error: Error) => void;
  maxToolRounds?: number;
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
  } = options;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  // Pure completion mode — no tools, no exhaustion message
  if (maxToolRounds === 0) {
    const response = await client.chat.completions.create({
      model: "MiniMax-M2.5",
      max_tokens: 16384,
      messages,
    });
    return response.choices[0]?.message?.content || "";
  }

  for (let round = 0; round < maxToolRounds; round++) {
    const response = await client.chat.completions.create({
      model: "MiniMax-M2.5",
      max_tokens: 16384,
      messages,
      tools: SCOUT_TOOLS,
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    const message = choice.message;
    messages.push(message);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content || "";
    }

    // Execute all tool calls in parallel for concurrency
    const functionCalls = message.tool_calls.filter(tc => tc.type === "function");
    for (const tc of functionCalls) {
      onToolCall?.(tc.function.name, JSON.parse(tc.function.arguments));
    }

    const results = await Promise.allSettled(
      functionCalls.map(async (tc) => {
        const args = JSON.parse(tc.function.arguments);
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

  const finalResponse = await client.chat.completions.create({
    model: "MiniMax-M2.5",
    max_tokens: 16384,
    messages,
  });

  return finalResponse.choices[0]?.message?.content || "";
}

export { client, SCOUT_TOOLS };
