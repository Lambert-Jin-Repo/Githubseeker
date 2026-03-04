"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useScoutStore } from "@/stores/scout-store";
import { getOrCreateSessionId } from "@/lib/session";

export function useScoutStream(searchId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const queryRef = useRef<string | null>(null);

  useEffect(() => {
    if (!searchId) {
      setIsLoadingSaved(false);
      return;
    }

    let cancelled = false;

    (async () => {
      // Try loading saved results first
      try {
        const res = await fetch(`/api/scout/${searchId}/results`);
        if (res.ok && !cancelled) {
          const data = await res.json();

          if (data.search?.phase1_complete) {
            // Reset store before hydrating to prevent duplicates (React strict mode)
            useScoutStore.getState().reset();
            useScoutStore.getState().setSearchMeta({
              id: searchId,
              query: data.search.query,
              mode: data.search.mode,
              topic_extracted: data.search.topic_extracted || data.search.query,
              searches_performed: 0,
              repos_evaluated: data.results?.length || 0,
              repos_verified: 0,
              created_at: data.search.created_at,
            });
            useScoutStore.getState().setMode(data.search.mode);
            queryRef.current = data.search.query;

            for (const obs of data.search.observations || []) {
              useScoutStore.getState().addObservation(obs);
            }

            for (const repo of data.results || []) {
              useScoutStore.getState().addRepo(repo);
              if (repo.deep_dive) {
                useScoutStore.getState().addDeepDiveResult(repo.deep_dive);
              }
            }

            useScoutStore.getState().setPhase1Complete(true);
            useScoutStore.getState().setIsSearching(false);

            if (data.search.phase2_complete) {
              useScoutStore.getState().setPhase2Complete(true);
            }

            setIsComplete(true);
            setIsLoadingSaved(false);
            return; // Don't connect to SSE
          }
        }
      } catch {
        // Failed to load saved results, fall back to SSE
      }

      setIsLoadingSaved(false);
      if (cancelled) return;

      // Fall back to SSE stream
      const connect = () => {
        const es = new EventSource(`/api/scout?id=${searchId}`);
        eventSourceRef.current = es;

        es.onopen = () => {
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;
        };

        es.addEventListener("mode_detected", (e) => {
          const data = JSON.parse(e.data);
          useScoutStore.getState().setMode(data.mode);
          queryRef.current = data.topic || "";
          useScoutStore.getState().setSearchMeta({
            id: searchId,
            query: data.topic || "",
            mode: data.mode,
            topic_extracted: data.topic || "",
            searches_performed: 0,
            repos_evaluated: 0,
            repos_verified: 0,
            created_at: new Date().toISOString(),
          });
        });

        es.addEventListener("search_progress", (e) => {
          const data = JSON.parse(e.data);
          useScoutStore.getState().addSearchProgress(data);
        });

        es.addEventListener("repo_discovered", (e) => {
          const data = JSON.parse(e.data);
          useScoutStore.getState().addRepo(data);
        });

        es.addEventListener("verification_update", (e) => {
          const data = JSON.parse(e.data);
          useScoutStore.getState().updateRepoVerification(data.repo_url, data.verification);
        });

        es.addEventListener("observation", (e) => {
          const data = JSON.parse(e.data);
          useScoutStore.getState().addObservation(data.text);
        });

        es.addEventListener("curated_list", (e) => {
          const data = JSON.parse(e.data);
          useScoutStore.getState().addCuratedList(data);
        });

        es.addEventListener("industry_tool", (e) => {
          const data = JSON.parse(e.data);
          useScoutStore.getState().addIndustryTool(data);
        });

        es.addEventListener("search_error", (e) => {
          const data = JSON.parse(e.data);
          console.warn(`Search error (${data.strategy}): ${data.message}`);
        });

        // Listen for custom SSE error events from the server
        es.addEventListener("error", (e) => {
          // This handles the custom "error" SSE event (not the native EventSource error)
          try {
            const data = JSON.parse((e as MessageEvent).data);
            if (data.recoverable) {
              setError((data.message || "Something went wrong") + " — partial results shown below");
              useScoutStore.getState().setPhase1Complete(true);
              useScoutStore.getState().setIsSearching(false);
              setIsComplete(true);
              es.close();
            } else {
              setError(data.message || "Search failed");
            }
          } catch {
            // Not a JSON payload — might be a native EventSource error, handled by es.onerror
          }
        });

        es.addEventListener("phase1_complete", () => {
          setIsComplete(true);
          useScoutStore.getState().setPhase1Complete(true);
          useScoutStore.getState().setIsSearching(false);
          es.close();
        });

        es.onerror = () => {
          if (reconnectAttemptsRef.current < 3) {
            reconnectAttemptsRef.current += 1;
            es.close();
            setTimeout(connect, 1000 * reconnectAttemptsRef.current);
          } else {
            es.close();
            setError("Connection lost. Please refresh the page.");
            setIsConnected(false);
          }
        };
      };

      connect();
    })();

    return () => {
      cancelled = true;
      eventSourceRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchId]);

  const retrySearch = useCallback(async () => {
    const query = queryRef.current;
    if (!query) return;

    try {
      getOrCreateSessionId();
      const res = await fetch("/api/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, force_refresh: true }),
      });
      const data = await res.json();
      if (data.id) {
        window.location.href = `/scout/${data.id}`;
      }
    } catch {
      setError("Failed to retry search. Please try again.");
    }
  }, []);

  return { isConnected, isComplete, isLoadingSaved, error, retrySearch };
}
