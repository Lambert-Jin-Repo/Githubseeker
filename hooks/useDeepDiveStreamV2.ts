"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useScoutStore } from "@/stores/scout-store";
import type { DeepDiveResultV2, ScoutSummaryV2 } from "@/lib/types";
import { parseSSEEvents } from "@/lib/sse-parser";

export interface DeepDiveProgressV2 {
  completed: number;
  total: number;
}

export type DeepDivePhase =
  | "idle"
  | "checking_db"
  | "fetching_data"
  | "analyzing"
  | "summarizing"
  | "complete";

interface UseDeepDiveStreamV2Return {
  startDeepDive: (repoUrls: string[]) => void;
  isStreaming: boolean;
  progress: DeepDiveProgressV2;
  error: string | null;
  isComplete: boolean;
  phase: DeepDivePhase;
}

/**
 * Detects whether a deep_dive result is V2 format.
 * V1 uses `what_it_does`, V2 uses `overview`.
 */
function isV2Result(deepDive: Record<string, unknown>): boolean {
  return "overview" in deepDive && !("what_it_does" in deepDive);
}

export function useDeepDiveStreamV2(
  searchId: string | null
): UseDeepDiveStreamV2Return {
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState<DeepDiveProgressV2>({
    completed: 0,
    total: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [phase, setPhase] = useState<DeepDivePhase>("idle");
  const abortControllerRef = useRef<AbortController | null>(null);
  const store = useScoutStore();

  const startDeepDive = useCallback(
    (repoUrls: string[]) => {
      if (!searchId || isStreaming) return;

      // Abort any previous request
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsStreaming(true);
      setError(null);
      setIsComplete(false);
      setProgress({ completed: 0, total: repoUrls.length });
      setPhase("checking_db");
      store.setIsDeepDiving(true);

      (async () => {
        try {
          // Step 1: Check DB for pre-computed V2 deep dive results
          let ready: DeepDiveResultV2[] = [];
          let missing: string[] = [...repoUrls];

          try {
            const res = await fetch(`/api/scout/${searchId}/results`, {
              signal: abortController.signal,
            });
            if (res.ok) {
              const data = await res.json();
              const results: Array<{
                repo_url: string;
                deep_dive: Record<string, unknown> | null;
              }> = data.results || [];

              const selectedSet = new Set(repoUrls);
              const precomputed = results.filter(
                (r) =>
                  selectedSet.has(r.repo_url) &&
                  r.deep_dive != null &&
                  isV2Result(r.deep_dive)
              );

              ready = precomputed.map(
                (r) => r.deep_dive as unknown as DeepDiveResultV2
              );
              const readyUrls = new Set(ready.map((r) => r.repo_url));
              missing = repoUrls.filter((url) => !readyUrls.has(url));
            }
          } catch (fetchErr) {
            if ((fetchErr as Error).name === "AbortError") throw fetchErr;
            // Failed to check DB - fall through to stream all
          }

          // Step 2: Instantly add pre-computed results to the store
          for (const result of ready) {
            store.addDeepDiveResultV2(result);
          }

          const totalRepos = ready.length + missing.length;
          setProgress({ completed: ready.length, total: totalRepos });

          // If all repos are precomputed and there are none missing,
          // we still need to call the API for the summary
          if (missing.length === 0 && ready.length > 0) {
            setPhase("summarizing");
          } else if (missing.length > 0) {
            setPhase("fetching_data");
          }

          // Step 3: POST to V2 deep-dive route
          const response = await fetch(
            `/api/scout/${searchId}/deep-dive-v2`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                repo_urls: missing,
                precomputed_results: ready,
              }),
              signal: abortController.signal,
            }
          );

          if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(
              (errBody as { error?: string }).error ||
                `HTTP ${response.status}`
            );
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error("No response body");
          }

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE blocks (separated by double newline)
            const lastDoubleNewline = buffer.lastIndexOf("\n\n");
            if (lastDoubleNewline === -1) continue;

            const complete = buffer.slice(0, lastDoubleNewline + 2);
            buffer = buffer.slice(lastDoubleNewline + 2);

            const events = parseSSEEvents(complete);

            for (const { event, data } of events) {
              try {
                const parsed = JSON.parse(data);

                switch (event) {
                  case "deep_dive_fetch_start": {
                    setPhase("fetching_data");
                    break;
                  }

                  case "deep_dive_analyze_start": {
                    setPhase("analyzing");
                    break;
                  }

                  case "deep_dive_complete_v2": {
                    const result = parsed as DeepDiveResultV2;
                    const isPrecomputed = ready.some(
                      (r) => r.repo_url === result.repo_url
                    );
                    if (!isPrecomputed) {
                      store.addDeepDiveResultV2(result);
                      setProgress((prev) => ({
                        ...prev,
                        completed: prev.completed + 1,
                      }));
                    }
                    break;
                  }

                  case "summary_v2": {
                    const summary = parsed as ScoutSummaryV2;
                    store.setSummaryV2(summary);
                    store.setPhase2Complete(true);
                    store.setIsDeepDiving(false);
                    setPhase("complete");
                    setIsComplete(true);
                    break;
                  }

                  case "error": {
                    const errData = parsed as {
                      message: string;
                      recoverable: boolean;
                    };
                    if (!errData.recoverable) {
                      setError(errData.message);
                    }
                    break;
                  }

                  default:
                    break;
                }
              } catch {
                // Skip malformed JSON lines
              }
            }
          }
        } catch (err) {
          if ((err as Error).name === "AbortError") {
            return;
          }
          const message =
            err instanceof Error ? err.message : "Deep dive failed";
          setError(message);
          store.setIsDeepDiving(false);
        } finally {
          setIsStreaming(false);
        }
      })();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchId, isStreaming]
  );

  // Abort in-flight request on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return { startDeepDive, isStreaming, progress, error, isComplete, phase };
}
