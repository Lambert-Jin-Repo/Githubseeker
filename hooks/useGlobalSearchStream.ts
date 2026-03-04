"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSearchNotificationStore } from "@/stores/search-notification-store";
import { useScoutStore } from "@/stores/scout-store";

/**
 * Global SSE listener that runs at the layout level.
 * Uses Zustand subscribe to detect new searches and manages
 * the EventSource lifecycle outside React's effect cleanup cycle.
 */
export function useGlobalSearchStream() {
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const activeSearchIdRef = useRef<string | null>(null);

    useEffect(() => {
        const notifStore = useSearchNotificationStore;
        const scoutStore = useScoutStore;

        function openSSE(searchId: string) {
            // Close any previous connection
            eventSourceRef.current?.close();
            activeSearchIdRef.current = searchId;
            reconnectAttemptsRef.current = 0;

            const connect = () => {
                // Bail if a different search has started since
                if (activeSearchIdRef.current !== searchId) return;

                const es = new EventSource(`/api/scout?id=${searchId}`);
                eventSourceRef.current = es;

                es.onopen = () => {
                    notifStore.getState().setConnected();
                    reconnectAttemptsRef.current = 0;
                };

                es.addEventListener("mode_detected", (e) => {
                    const data = JSON.parse(e.data);
                    scoutStore.getState().setMode(data.mode);
                    scoutStore.getState().setSearchMeta({
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
                    notifStore.getState().updateProgress(data);
                    scoutStore.getState().addSearchProgress(data);
                });

                es.addEventListener("repo_discovered", (e) => {
                    const data = JSON.parse(e.data);
                    scoutStore.getState().addRepo(data);
                    notifStore.getState().incrementRepos();
                });

                es.addEventListener("verification_update", (e) => {
                    const data = JSON.parse(e.data);
                    scoutStore.getState().updateRepoVerification(data.repo_url, data.verification);
                });

                es.addEventListener("observation", (e) => {
                    const data = JSON.parse(e.data);
                    scoutStore.getState().addObservation(data.text);
                });

                es.addEventListener("curated_list", (e) => {
                    const data = JSON.parse(e.data);
                    scoutStore.getState().addCuratedList(data);
                });

                es.addEventListener("industry_tool", (e) => {
                    const data = JSON.parse(e.data);
                    scoutStore.getState().addIndustryTool(data);
                });

                es.addEventListener("search_error", (e) => {
                    const data = JSON.parse(e.data);
                    console.warn(`[GlobalSearch] Search error (${data.strategy}): ${data.message}`);
                });

                // Custom SSE "error" event from server
                es.addEventListener("error", (e) => {
                    try {
                        const data = JSON.parse((e as MessageEvent).data);
                        if (data.recoverable) {
                            toast.warning("Search partially completed. Showing available results.");
                            notifStore.getState().setComplete();
                            scoutStore.getState().setPhase1Complete(true);
                            scoutStore.getState().setIsSearching(false);
                            es.close();
                        } else {
                            notifStore.getState().setError(data.message || "Search failed");
                            toast.error("Search failed. Please try again.");
                        }
                    } catch {
                        // Native EventSource error, handled by es.onerror
                    }
                });

                es.addEventListener("phase1_complete", () => {
                    notifStore.getState().setComplete();
                    scoutStore.getState().setPhase1Complete(true);
                    scoutStore.getState().setIsSearching(false);
                    es.close();
                });

                es.onerror = () => {
                    if (reconnectAttemptsRef.current < 3) {
                        reconnectAttemptsRef.current += 1;
                        es.close();
                        setTimeout(connect, 1000 * reconnectAttemptsRef.current);
                    } else {
                        es.close();
                        notifStore.getState().setError("Connection lost. Please try again.");
                        toast.error("Connection lost. Check your internet and try again.");
                    }
                };
            };

            connect();
        }

        // Subscribe to store changes: when a new search starts (status becomes "connecting"),
        // open the SSE connection. This runs outside React's effect lifecycle.
        const unsub = notifStore.subscribe((state, prevState) => {
            if (
                state.status === "connecting" &&
                prevState.status !== "connecting" &&
                state.searchId &&
                state.searchId !== activeSearchIdRef.current
            ) {
                openSSE(state.searchId);
            }
        });

        // Also handle the case where status is already "connecting" on mount
        // (e.g., if the component mounts after startSearch was called)
        const current = notifStore.getState();
        if (
            current.status === "connecting" &&
            current.searchId &&
            current.searchId !== activeSearchIdRef.current
        ) {
            openSSE(current.searchId);
        }

        return () => {
            unsub();
            eventSourceRef.current?.close();
            activeSearchIdRef.current = null;
        };
    }, []); // Empty deps — runs once, manages lifecycle via subscribe
}


