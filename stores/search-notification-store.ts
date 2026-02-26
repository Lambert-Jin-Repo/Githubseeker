import { create } from "zustand";
import type { ScoutMode } from "@/lib/types";

export type SearchNotificationStatus =
  | "idle"
  | "connecting"
  | "searching"
  | "complete"
  | "error";

interface SearchNotificationState {
  searchId: string | null;
  query: string | null;
  mode: ScoutMode | null;
  status: SearchNotificationStatus;
  strategiesTotal: number;
  strategiesComplete: number;
  reposFound: number;
  currentStrategy: string | null;
  error: string | null;
  startedAt: number | null;
}

interface SearchNotificationActions {
  startSearch: (searchId: string, query: string, mode: ScoutMode) => void;
  setConnected: () => void;
  updateProgress: (data: {
    strategy: string;
    status: string;
    repos_found?: number;
  }) => void;
  incrementRepos: () => void;
  setReposFound: (count: number) => void;
  setComplete: () => void;
  setError: (message: string) => void;
  dismiss: () => void;
}

type SearchNotificationStore = SearchNotificationState &
  SearchNotificationActions;

const initialState: SearchNotificationState = {
  searchId: null,
  query: null,
  mode: null,
  status: "idle",
  strategiesTotal: 0,
  strategiesComplete: 0,
  reposFound: 0,
  currentStrategy: null,
  error: null,
  startedAt: null,
};

export const useSearchNotificationStore = create<SearchNotificationStore>(
  (set) => ({
    ...initialState,

    startSearch: (searchId, query, mode) =>
      set({
        ...initialState,
        searchId,
        query,
        mode,
        status: "connecting",
        startedAt: Date.now(),
      }),

    setConnected: () =>
      set((s) => (s.status === "connecting" ? { status: "searching" } : {})),

    updateProgress: (data) =>
      set((s) => {
        const isNew =
          data.status === "running" &&
          s.currentStrategy !== data.strategy;
        const isComplete = data.status === "complete";
        const isFailed = data.status === "failed";

        return {
          status: "searching",
          currentStrategy: isNew ? data.strategy : s.currentStrategy,
          strategiesTotal: isNew
            ? s.strategiesTotal + 1
            : s.strategiesTotal,
          strategiesComplete:
            isComplete || isFailed
              ? s.strategiesComplete + 1
              : s.strategiesComplete,
        };
      }),

    incrementRepos: () =>
      set((s) => ({ reposFound: s.reposFound + 1 })),

    setReposFound: (count) => set({ reposFound: count }),

    setComplete: () => set({ status: "complete", currentStrategy: null }),

    setError: (message) =>
      set({ status: "error", error: message, currentStrategy: null }),

    dismiss: () => set(initialState),
  })
);
