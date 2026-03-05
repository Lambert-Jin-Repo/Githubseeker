/**
 * Fire-and-forget API usage logger with cost calculation.
 *
 * All log functions are wrapped in try/catch and never throw or block the caller.
 * They insert rows into the `api_usage_logs` Supabase table asynchronously.
 */

import { createServerClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Pricing constants (per token / per query)
// ---------------------------------------------------------------------------

interface ProviderPricing {
  inputPer1M: number; // USD per 1M input tokens
  outputPer1M: number; // USD per 1M output tokens
}

const LLM_PRICING: Record<string, ProviderPricing> = {
  minimax: { inputPer1M: 0.3, outputPer1M: 1.2 },
  openai: { inputPer1M: 0.15, outputPer1M: 0.6 },
  deepseek: { inputPer1M: 0.14, outputPer1M: 0.28 },
};

const SERPER_COST_PER_QUERY = 0.001; // $1.00 / 1K queries

// ---------------------------------------------------------------------------
// Cost calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the USD cost for an LLM call based on provider pricing.
 * Returns 0 for unknown providers or zero tokens.
 */
export function calculateLLMCost(
  provider: string,
  tokensIn: number,
  tokensOut: number
): number {
  const pricing = LLM_PRICING[provider];
  if (!pricing) return 0;
  if (tokensIn === 0 && tokensOut === 0) return 0;

  const inputCost = (tokensIn * pricing.inputPer1M) / 1_000_000;
  const outputCost = (tokensOut * pricing.outputPer1M) / 1_000_000;
  return inputCost + outputCost;
}

// ---------------------------------------------------------------------------
// Log parameter types
// ---------------------------------------------------------------------------

export interface LogLLMCallParams {
  search_id: string;
  provider: string;
  model: string;
  operation: string;
  success: boolean;
  latency_ms: number;
  tokens_in: number;
  tokens_out: number;
  error_type?: string;
  tool_round?: number;
  metadata?: Record<string, unknown>;
}

export interface LogSerperCallParams {
  search_id: string;
  success: boolean;
  latency_ms: number;
  query?: string;
  error_type?: string;
  metadata?: Record<string, unknown>;
}

export interface LogGitHubFetchParams {
  search_id: string;
  success: boolean;
  latency_ms: number;
  url?: string;
  error_type?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Logging functions (fire-and-forget)
// ---------------------------------------------------------------------------

/**
 * Log an LLM API call with auto-calculated cost.
 * Never throws, never blocks the caller.
 */
export function logLLMCall(params: LogLLMCallParams): void {
  try {
    const supabase = createServerClient();
    const cost_usd = calculateLLMCost(
      params.provider,
      params.tokens_in,
      params.tokens_out
    );

    supabase
      .from("api_usage_logs")
      .insert({
        search_id: params.search_id,
        provider: params.provider,
        model: params.model,
        operation: params.operation,
        success: params.success,
        latency_ms: params.latency_ms,
        tokens_in: params.tokens_in,
        tokens_out: params.tokens_out,
        cost_usd,
        error_type: params.error_type ?? null,
        tool_round: params.tool_round ?? null,
        metadata: params.metadata ?? null,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[api-logger] Failed to log LLM call:", error.message);
        }
      });
  } catch {
    // createServerClient() may throw if env vars missing — silently ignore
  }
}

/**
 * Log a Serper web search API call.
 * Never throws, never blocks the caller.
 */
export function logSerperCall(params: LogSerperCallParams): void {
  try {
    const supabase = createServerClient();

    const metadata: Record<string, unknown> = { ...params.metadata };
    if (params.query) {
      metadata.query = params.query;
    }

    supabase
      .from("api_usage_logs")
      .insert({
        search_id: params.search_id,
        provider: "serper",
        operation: "web_search",
        success: params.success,
        latency_ms: params.latency_ms,
        cost_usd: SERPER_COST_PER_QUERY,
        error_type: params.error_type ?? null,
        tokens_in: null,
        tokens_out: null,
        model: null,
        tool_round: null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      })
      .then(({ error }) => {
        if (error) {
          console.error(
            "[api-logger] Failed to log Serper call:",
            error.message
          );
        }
      });
  } catch {
    // silently ignore
  }
}

/**
 * Log a GitHub web fetch (free, cost = 0).
 * Never throws, never blocks the caller.
 */
export function logGitHubFetch(params: LogGitHubFetchParams): void {
  try {
    const supabase = createServerClient();

    const metadata: Record<string, unknown> = { ...params.metadata };
    if (params.url) {
      metadata.url = params.url;
    }

    supabase
      .from("api_usage_logs")
      .insert({
        search_id: params.search_id,
        provider: "github",
        operation: "web_fetch",
        success: params.success,
        latency_ms: params.latency_ms,
        cost_usd: 0,
        error_type: params.error_type ?? null,
        tokens_in: null,
        tokens_out: null,
        model: null,
        tool_round: null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      })
      .then(({ error }) => {
        if (error) {
          console.error(
            "[api-logger] Failed to log GitHub fetch:",
            error.message
          );
        }
      });
  } catch {
    // silently ignore
  }
}
