"use client";

import { useGlobalSearchStream } from "@/hooks/useGlobalSearchStream";

/**
 * Zero-UI wrapper that runs the global search SSE listener.
 * Placed in the root layout so the search runs across all pages.
 */
export function GlobalSearchStreamListener() {
    useGlobalSearchStream();
    return null;
}
