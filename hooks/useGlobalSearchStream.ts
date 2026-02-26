"use client";

import { useEffect, useRef } from "react";
import { useSearchNotificationStore } from "@/stores/search-notification-store";
import { useScoutStore } from "@/stores/scout-store";

/**
 * Global SSE listener that runs at the layout level.
 * When the notification store has a searchId with status "connecting",
 * it opens an EventSource to stream results and updates both stores.
 */
export function useGlobalSearchStream() {
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectAttemptsRef = useRef(0);

    const searchId = useSearchNotificationStore((s) => s.searchId);
    const status = useSearchNotificationStore((s) => s.status);

    const notifStore = useSearchNotificationStore;
    const scoutStore = useScoutStore;

    useEffect(() => {
        // Only connect when status is "connecting" (freshly started search)
        if (!searchId || status !== "connecting") return;

        let cancelled = false;

        const connect = () => {
            if (cancelled) return;

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
                        notifStore.getState().setComplete();
                        scoutStore.getState().setPhase1Complete(true);
                        scoutStore.getState().setIsSearching(false);
                        es.close();
                    } else {
                        notifStore.getState().setError(data.message || "Search failed");
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
                    notifStore.getState().setError("Connection lost. Please try again.");
                }
            };
        };

        connect();

        return () => {
            cancelled = true;
            eventSourceRef.current?.close();
        };
    }, [searchId, status, notifStore, scoutStore]);
}
