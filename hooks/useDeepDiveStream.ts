"use client";

import { useCallback, useRef, useState } from "react";
import { useScoutStore } from "@/stores/scout-store";
import type { DeepDiveResult, ScoutSummary } from "@/lib/types";

interface DeepDiveProgress {
  completed: number;
  total: number;
}

interface UseDeepDiveStreamReturn {
  startDeepDive: (repoUrls: string[]) => void;
  isStreaming: boolean;
  progress: DeepDiveProgress;
  error: string | null;
}

/**
 * Parses an SSE text chunk into individual events.
 * Handles the `event: xxx\ndata: {...}\n\n` format,
 * including partial chunks from streamed responses.
 */
function parseSSEEvents(text: string): { event: string; data: string }[] {
  const events: { event: string; data: string }[] = [];
  const blocks = text.split("\n\n");

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    let eventName = "message";
    let dataLine = "";

    const lines = trimmed.split("\n");
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventName = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        dataLine = line.slice(6);
      }
    }

    if (dataLine) {
      events.push({ event: eventName, data: dataLine });
    }
  }

  return events;
}

export function useDeepDiveStream(
  searchId: string | null
): UseDeepDiveStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState<DeepDiveProgress>({
    completed: 0,
    total: 0,
  });
  const [error, setError] = useState<string | null>(null);
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
      setProgress({ completed: 0, total: repoUrls.length });
      store.setIsDeepDiving(true);

      (async () => {
        try {
          // Step 1: Check DB for pre-computed deep dive results
          let ready: DeepDiveResult[] = [];
          let missing: string[] = [...repoUrls];

          try {
            const res = await fetch(`/api/scout/${searchId}/results`, {
              signal: abortController.signal,
            });
            if (res.ok) {
              const data = await res.json();
              const results: Array<{
                repo_url: string;
                deep_dive: DeepDiveResult | null;
              }> = data.results || [];

              const selectedSet = new Set(repoUrls);
              const precomputed = results.filter(
                (r) => selectedSet.has(r.repo_url) && r.deep_dive != null
              );

              ready = precomputed.map((r) => r.deep_dive!);
              const readyUrls = new Set(ready.map((r) => r.repo_url));
              missing = repoUrls.filter((url) => !readyUrls.has(url));
            }
          } catch (fetchErr) {
            if ((fetchErr as Error).name === "AbortError") throw fetchErr;
            // Failed to check DB — fall through to stream all
          }

          // Step 2: Instantly add pre-computed results to the store
          for (const result of ready) {
            store.addDeepDiveResult(result);
          }

          const totalRepos = ready.length + missing.length;
          setProgress({ completed: ready.length, total: totalRepos });

          // Step 3: POST to deep-dive route
          // - If all ready: summary-only (repo_urls=[], precomputed_results=ready)
          // - If some missing: stream missing, include precomputed for summary context
          const response = await fetch(
            `/api/scout/${searchId}/deep-dive`,
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
          let completedCount = ready.length;

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
                  case "deep_dive_start": {
                    // Progress feedback only
                    break;
                  }

                  case "deep_dive_section": {
                    // Progress feedback — no store action needed
                    break;
                  }

                  case "deep_dive_complete": {
                    const result = parsed as DeepDiveResult;
                    // Only add to store if this wasn't a pre-computed result
                    // (pre-computed results were already re-emitted by the server,
                    //  but we added them to the store in step 2)
                    const isPrecomputed = ready.some(
                      (r) => r.repo_url === result.repo_url
                    );
                    if (!isPrecomputed) {
                      store.addDeepDiveResult(result);
                      completedCount += 1;
                      setProgress((prev) => ({
                        ...prev,
                        completed: completedCount,
                      }));
                    }
                    break;
                  }

                  case "summary": {
                    const summary = parsed as ScoutSummary;
                    store.setSummary(summary);
                    store.setPhase2Complete(true);
                    store.setIsDeepDiving(false);
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

  return { startDeepDive, isStreaming, progress, error };
}
