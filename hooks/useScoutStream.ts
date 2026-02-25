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

    return () => {
      eventSourceRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchId]);

  return { isConnected, isComplete, error };
}
