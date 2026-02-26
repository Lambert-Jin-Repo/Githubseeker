import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock openai module
vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: class {
      chat = { completions: { create: mockCreate } };
    },
    __mockCreate: mockCreate,
  };
});

// Mock web-search module
vi.mock("../web-search", () => ({
  webSearch: vi.fn().mockResolvedValue([{ title: "test", url: "https://example.com", description: "desc" }]),
  fetchWebPage: vi.fn().mockResolvedValue("<html>page</html>"),
  fetchGitHubMetadata: vi.fn().mockResolvedValue({
    url: "https://github.com/owner/repo",
    description: "A repo",
    stars: 1000,
    language: "TypeScript",
    license: "MIT",
    lastCommit: "2026-01-01T00:00:00Z",
    topics: [],
    archived: false,
  }),
}));

import { callLLMWithTools } from "../llm";
import { webSearch, fetchWebPage, fetchGitHubMetadata } from "../web-search";

// Access the mock create function
const getMockCreate = async () => {
  const mod = await import("openai");
  return (mod as unknown as { __mockCreate: ReturnType<typeof vi.fn> }).__mockCreate;
};

describe("callLLMWithTools", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCreate = await getMockCreate();
  });

  it("returns content directly when maxToolRounds is 0 (pure completion)", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Direct answer", tool_calls: null } }],
    });

    const result = await callLLMWithTools({
      systemPrompt: "You are a test",
      userMessage: "Hello",
      maxToolRounds: 0,
    });

    expect(result).toBe("Direct answer");
    // Should NOT include tools in the call
    expect(mockCreate).toHaveBeenCalledWith(
      expect.not.objectContaining({ tools: expect.anything() })
    );
  });

  it("returns LLM content when no tool calls are requested", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Final answer", tool_calls: [] } }],
    });

    const result = await callLLMWithTools({
      systemPrompt: "System",
      userMessage: "User",
    });

    expect(result).toBe("Final answer");
  });

  it("executes tool calls in parallel and preserves message order", async () => {
    const executionOrder: string[] = [];

    // First LLM call returns two tool calls
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: null,
          tool_calls: [
            { id: "tc1", type: "function", function: { name: "web_search", arguments: '{"query":"test1"}' } },
            { id: "tc2", type: "function", function: { name: "web_search", arguments: '{"query":"test2"}' } },
          ],
        },
      }],
    });

    // Second LLM call returns final answer
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Final result", tool_calls: [] } }],
    });

    // Make the first search slower to verify parallel execution
    vi.mocked(webSearch)
      .mockImplementationOnce(async () => {
        executionOrder.push("search1_start");
        await new Promise((r) => setTimeout(r, 50));
        executionOrder.push("search1_end");
        return [{ title: "r1", url: "https://a.com", description: "d1" }];
      })
      .mockImplementationOnce(async () => {
        executionOrder.push("search2_start");
        await new Promise((r) => setTimeout(r, 10));
        executionOrder.push("search2_end");
        return [{ title: "r2", url: "https://b.com", description: "d2" }];
      });

    const result = await callLLMWithTools({
      systemPrompt: "System",
      userMessage: "User",
    });

    expect(result).toBe("Final result");

    // Both should start before either finishes (parallel execution)
    expect(executionOrder[0]).toBe("search1_start");
    expect(executionOrder[1]).toBe("search2_start");
  });

  it("fires onToolCall for each tool before execution begins", async () => {
    const toolCalls: string[] = [];

    mockCreate
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: null,
            tool_calls: [
              { id: "tc1", type: "function", function: { name: "web_search", arguments: '{"query":"a"}' } },
              { id: "tc2", type: "function", function: { name: "web_fetch", arguments: '{"url":"https://example.com"}' } },
            ],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: "Done", tool_calls: [] } }],
      });

    await callLLMWithTools({
      systemPrompt: "System",
      userMessage: "User",
      onToolCall(name) { toolCalls.push(name); },
    });

    expect(toolCalls).toEqual(["web_search", "web_fetch"]);
  });

  it("fires onToolResult for each tool after execution", async () => {
    const results: string[] = [];

    mockCreate
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: null,
            tool_calls: [
              { id: "tc1", type: "function", function: { name: "web_search", arguments: '{"query":"test"}' } },
            ],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: "Done", tool_calls: [] } }],
      });

    await callLLMWithTools({
      systemPrompt: "System",
      userMessage: "User",
      onToolResult(name, result) { results.push(`${name}:${result.slice(0, 20)}`); },
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatch(/^web_search:/);
  });

  it("handles tool execution errors via onToolError", async () => {
    const errors: string[] = [];

    vi.mocked(webSearch).mockRejectedValueOnce(new Error("API down"));

    mockCreate
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: null,
            tool_calls: [
              { id: "tc1", type: "function", function: { name: "web_search", arguments: '{"query":"test"}' } },
            ],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: "Recovered", tool_calls: [] } }],
      });

    const result = await callLLMWithTools({
      systemPrompt: "System",
      userMessage: "User",
      onToolError(name, err) { errors.push(`${name}:${err.message}`); },
    });

    expect(result).toBe("Recovered");
    expect(errors).toEqual(["web_search:API down"]);
  });

  it("routes GitHub repo URLs through fetchGitHubMetadata", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: null,
            tool_calls: [
              { id: "tc1", type: "function", function: { name: "web_fetch", arguments: '{"url":"https://github.com/vercel/next.js"}' } },
            ],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: "Done", tool_calls: [] } }],
      });

    await callLLMWithTools({
      systemPrompt: "System",
      userMessage: "User",
    });

    expect(fetchGitHubMetadata).toHaveBeenCalledWith("https://github.com/vercel/next.js");
    expect(fetchWebPage).not.toHaveBeenCalled();
  });

  it("uses fetchWebPage for non-GitHub URLs", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: null,
            tool_calls: [
              { id: "tc1", type: "function", function: { name: "web_fetch", arguments: '{"url":"https://example.com/article"}' } },
            ],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: "Done", tool_calls: [] } }],
      });

    await callLLMWithTools({
      systemPrompt: "System",
      userMessage: "User",
    });

    expect(fetchWebPage).toHaveBeenCalledWith("https://example.com/article");
    expect(fetchGitHubMetadata).not.toHaveBeenCalled();
  });

  it("uses fetchWebPage for GitHub sub-page URLs (not top-level repo)", async () => {
    mockCreate
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: null,
            tool_calls: [
              { id: "tc1", type: "function", function: { name: "web_fetch", arguments: '{"url":"https://github.com/vercel/next.js/issues/123"}' } },
            ],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: "Done", tool_calls: [] } }],
      });

    await callLLMWithTools({
      systemPrompt: "System",
      userMessage: "User",
    });

    expect(fetchWebPage).toHaveBeenCalledWith("https://github.com/vercel/next.js/issues/123");
    expect(fetchGitHubMetadata).not.toHaveBeenCalled();
  });

  it("sends exhaustion prompt when maxToolRounds is exceeded", async () => {
    // Two rounds of tool calls, then exhaustion
    for (let i = 0; i < 2; i++) {
      mockCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: null,
            tool_calls: [
              { id: `tc${i}`, type: "function", function: { name: "web_search", arguments: '{"query":"q"}' } },
            ],
          },
        }],
      });
    }
    // Final call after exhaustion
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"repos":[]}', tool_calls: null } }],
    });

    const result = await callLLMWithTools({
      systemPrompt: "System",
      userMessage: "User",
      maxToolRounds: 2,
    });

    expect(result).toBe('{"repos":[]}');
    // 2 tool rounds + 1 exhaustion call = 3 total
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });
});
