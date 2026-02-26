"use client";

import { useEffect, useRef, useState } from "react";
import { useScoutStore } from "@/stores/scout-store";

export function useScoutStream(searchId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const store = useScoutStore();

  useEffect(() => {
    if (!searchId) return;

    let cancelled = false;

    (async () => {
      // Try loading saved results first
      try {
        const res = await fetch(`/api/scout/${searchId}/results`);
        if (res.ok && !cancelled) {
          const data = await res.json();

          if (data.search?.phase1_complete) {
            // Reset store before hydrating to prevent duplicates (React strict mode)
            store.reset();
            store.setSearchMeta({
              id: searchId,
              query: data.search.query,
              mode: data.search.mode,
              topic_extracted: data.search.topic_extracted || data.search.query,
              searches_performed: 0,
              repos_evaluated: data.results?.length || 0,
              repos_verified: 0,
              created_at: data.search.created_at,
            });
            store.setMode(data.search.mode);

            for (const obs of data.search.observations || []) {
              store.addObservation(obs);
            }

            for (const repo of data.results || []) {
              store.addRepo(repo);
              if (repo.deep_dive) {
                store.addDeepDiveResult(repo.deep_dive);
              }
            }

            store.setPhase1Complete(true);
            store.setIsSearching(false);

            if (data.search.phase2_complete) {
              store.setPhase2Complete(true);
            }

            setIsComplete(true);
            return; // Don't connect to SSE
          }
        }
      } catch {
        // Failed to load saved results, fall back to SSE
      }

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
          store.setMode(data.mode);
          store.setSearchMeta({
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
          store.addSearchProgress(data);
        });

        es.addEventListener("repo_discovered", (e) => {
          const data = JSON.parse(e.data);
          store.addRepo(data);
        });

        es.addEventListener("verification_update", (e) => {
          const data = JSON.parse(e.data);
          store.updateRepoVerification(data.repo_url, data.verification);
        });

        es.addEventListener("observation", (e) => {
          const data = JSON.parse(e.data);
          store.addObservation(data.text);
        });

        es.addEventListener("curated_list", (e) => {
          const data = JSON.parse(e.data);
          store.addCuratedList(data);
        });

        es.addEventListener("industry_tool", (e) => {
          const data = JSON.parse(e.data);
          store.addIndustryTool(data);
        });

        es.addEventListener("phase1_complete", () => {
          setIsComplete(true);
          store.setPhase1Complete(true);
          store.setIsSearching(false);
          es.close();
        });

        es.onerror = () => {
          if (reconnectAttemptsRef.current < 3) {
            reconnectAttemptsRef.current += 1;
            es.close();
            setTimeout(connect, 1000 * reconnectAttemptsRef.current);
          } else {
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

  return { isConnected, isComplete, error };
}
