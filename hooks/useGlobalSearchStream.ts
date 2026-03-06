"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSearchNotificationStore } from "@/stores/search-notification-store";
import { useScoutStore } from "@/stores/scout-store";
import { createSSEClient, type SSEClientHandle } from "@/lib/sse-client";
import type { ScoutMode, RepoResult, RepoVerification } from "@/lib/types";

/**
 * Global SSE listener that runs at the layout level.
 * Uses Zustand subscribe to detect new searches and manages
 * the EventSource lifecycle outside React's effect cleanup cycle.
 */
export function useGlobalSearchStream() {
    const clientRef = useRef<SSEClientHandle | null>(null);
    const activeSearchIdRef = useRef<string | null>(null);

    useEffect(() => {
        const notifStore = useSearchNotificationStore;
        const scoutStore = useScoutStore;

        function openSSE(searchId: string) {
            // Close any previous connection
            clientRef.current?.close();
            activeSearchIdRef.current = searchId;

            clientRef.current = createSSEClient({
                url: `/api/scout?id=${searchId}`,
                onOpen: () => notifStore.getState().setConnected(),
                handlers: {
                    mode_detected(data: unknown) {
                        const d = data as Record<string, unknown>;
                        scoutStore.getState().setMode(d.mode as ScoutMode);
                        scoutStore.getState().setSearchMeta({
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
                        const d = data as { strategy: string; status: string; repos_found: number };
                        notifStore.getState().updateProgress(d);
                        scoutStore.getState().addSearchProgress(d);
                    },
                    repo_discovered(data: unknown) {
                        scoutStore.getState().addRepo(data as RepoResult);
                        notifStore.getState().incrementRepos();
                    },
                    verification_update(data: unknown) {
                        const d = data as Record<string, unknown>;
                        scoutStore.getState().updateRepoVerification(d.repo_url as string, d.verification as Partial<RepoVerification>);
                    },
                    observation(data: unknown) {
                        const d = data as Record<string, unknown>;
                        scoutStore.getState().addObservation(d.text as string);
                    },
                    curated_list(data: unknown) {
                        scoutStore.getState().addCuratedList(data as { name: string; url: string; description: string });
                    },
                    industry_tool(data: unknown) {
                        scoutStore.getState().addIndustryTool(data as { name: string; description: string; url?: string });
                    },
                    search_error(data: unknown) {
                        const d = data as Record<string, unknown>;
                        console.warn(`[GlobalSearch] Search error (${d.strategy}): ${d.message}`);
                    },
                },
                onServerError(data) {
                    if (data.recoverable) {
                        toast.warning("Search partially completed. Showing available results.");
                        notifStore.getState().setComplete();
                        scoutStore.getState().setPhase1Complete(true);
                        scoutStore.getState().setIsSearching(false);
                    } else {
                        notifStore.getState().setError(data.message || "Search failed");
                        toast.error("Search failed. Please try again.");
                    }
                    return true; // close the stream
                },
                onComplete() {
                    notifStore.getState().setComplete();
                    scoutStore.getState().setPhase1Complete(true);
                    scoutStore.getState().setIsSearching(false);
                },
                onConnectionLost() {
                    notifStore.getState().setError("Connection lost. Please try again.");
                    toast.error("Connection lost. Check your internet and try again.");
                },
            });
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
            clientRef.current?.close();
            activeSearchIdRef.current = null;
        };
    }, []); // Empty deps — runs once, manages lifecycle via subscribe
}
