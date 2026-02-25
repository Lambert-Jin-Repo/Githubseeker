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
          const response = await fetch(
            `/api/scout/${searchId}/deep-dive`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ repo_urls: repoUrls }),
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
          let completedCount = 0;

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
                    const startData = parsed as {
                      repo_url: string;
                      index: number;
                      total: number;
                    };
                    setProgress((prev) => ({
                      ...prev,
                      total: startData.total,
                    }));
                    break;
                  }

                  case "deep_dive_section": {
                    // Progress feedback — no store action needed
                    break;
                  }

                  case "deep_dive_complete": {
                    const result = parsed as DeepDiveResult;
                    store.addDeepDiveResult(result);
                    completedCount += 1;
                    setProgress((prev) => ({
                      ...prev,
                      completed: completedCount,
                    }));
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
                    // Recoverable errors are logged but don't stop the stream
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
            // User-initiated cancellation
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
