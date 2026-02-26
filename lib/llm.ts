import OpenAI from "openai";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { webSearch, fetchWebPage } from "./web-search";

const client = new OpenAI({
  apiKey: process.env.MINIMAX_API_KEY!,
  baseURL: "https://api.minimax.io/v1",
});

const SCOUT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for information. Use for discovering GitHub repos, checking Reddit, finding articles.",
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
        "Fetch the content of a web page. Use for verifying GitHub repos exist and extracting metadata.",
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
      const content = await fetchWebPage(args.url as string);
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

    for (const toolCall of message.tool_calls) {
      if (toolCall.type !== "function") continue;
      const args = JSON.parse(toolCall.function.arguments);
      onToolCall?.(toolCall.function.name, args);

      let result: string;
      try {
        result = await executeToolCall(toolCall.function.name, args);
      } catch (err) {
        const toolError = err instanceof Error ? err : new Error("Tool execution failed");
        onToolError?.(toolCall.function.name, toolError);
        result = JSON.stringify({
          error: toolError.message,
        });
      }
      onToolResult?.(toolCall.function.name, result);

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
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
