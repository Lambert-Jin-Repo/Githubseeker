"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { useScoutStore } from "@/stores/scout-store";
import { getOrCreateSessionId } from "@/lib/session";
import { createSSEClient, type SSEClientHandle } from "@/lib/sse-client";
import type { ScoutMode, RepoResult, RepoVerification } from "@/lib/types";

export function useScoutStream(searchId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<SSEClientHandle | null>(null);
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

      // Fall back to SSE stream using shared client
      clientRef.current = createSSEClient({
        url: `/api/scout?id=${searchId}`,
        onOpen() {
          setIsConnected(true);
          setError(null);
        },
        handlers: {
          mode_detected(data: unknown) {
            const d = data as Record<string, unknown>;
            useScoutStore.getState().setMode(d.mode as ScoutMode);
            queryRef.current = (d.topic as string) || "";
            useScoutStore.getState().setSearchMeta({
              id: searchId,
              query: (d.topic as string) || "",
              mode: d.mode as ScoutMode,
              topic_extracted: (d.topic as string) || "",
              searches_performed: 0,
              repos_evaluated: 0,
              repos_verified: 0,
              created_at: new Date().toISOString(),
            });
          },
          search_progress(data: unknown) {
            useScoutStore.getState().addSearchProgress(data as { strategy: string; status: string; repos_found: number });
          },
          repo_discovered(data: unknown) {
            useScoutStore.getState().addRepo(data as RepoResult);
          },
          verification_update(data: unknown) {
            const d = data as Record<string, unknown>;
            useScoutStore.getState().updateRepoVerification(d.repo_url as string, d.verification as Partial<RepoVerification>);
          },
          observation(data: unknown) {
            const d = data as Record<string, unknown>;
            useScoutStore.getState().addObservation(d.text as string);
          },
          curated_list(data: unknown) {
            useScoutStore.getState().addCuratedList(data as { name: string; url: string; description: string });
          },
          industry_tool(data: unknown) {
            useScoutStore.getState().addIndustryTool(data as { name: string; description: string; url?: string });
          },
          search_error(data: unknown) {
            const d = data as Record<string, unknown>;
            console.warn(`Search error (${d.strategy}): ${d.message}`);
          },
        },
        onServerError(data) {
          if (data.recoverable) {
            setError((data.message || "Something went wrong") + " — partial results shown below");
            toast.warning("Search partially completed. Showing available results.");
            useScoutStore.getState().setPhase1Complete(true);
            useScoutStore.getState().setIsSearching(false);
            setIsComplete(true);
          } else {
            setError(data.message || "Search failed");
            toast.error("Search failed. Please try again.");
          }
          return true; // close the stream
        },
        onComplete() {
          setIsComplete(true);
          useScoutStore.getState().setPhase1Complete(true);
          useScoutStore.getState().setIsSearching(false);
        },
        onConnectionLost() {
          setError("Connection lost. Please refresh the page.");
          toast.error("Connection lost. Check your internet and refresh the page.");
          setIsConnected(false);
        },
      });
    })();

    return () => {
      cancelled = true;
      clientRef.current?.close();
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
      toast.error("Failed to retry search. Please try again.");
    }
  }, []);

  return { isConnected, isComplete, isLoadingSaved, error, retrySearch };
}
