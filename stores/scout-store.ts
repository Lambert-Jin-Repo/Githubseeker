import { create } from "zustand";
import type {
  ScoutMode,
  SearchMeta,
  RepoResult,
  RepoVerification,
  DeepDiveResult,
  DeepDiveResultV2,
  ScoutSummary,
  ScoutSummaryV2,
} from "@/lib/types";

interface ScoutStore {
  searchMeta: SearchMeta | null;
  mode: ScoutMode | null;
  isSearching: boolean;

  repos: RepoResult[];
  searchProgress: { strategy: string; status: string; repos_found: number }[];
  observations: string[];
  curatedLists: { name: string; url: string; description: string }[];
  industryTools: { name: string; description: string; url?: string }[];
  phase1Complete: boolean;

  selectedRepoUrls: string[];
  deepDiveResults: DeepDiveResult[];
  summary: ScoutSummary | null;
  isDeepDiving: boolean;
  phase2Complete: boolean;

  deepDiveResultsV2: DeepDiveResultV2[];
  summaryV2: ScoutSummaryV2 | null;
  deepDivePageReady: boolean;

  setSearchMeta: (meta: SearchMeta) => void;
  setMode: (mode: ScoutMode) => void;
  setIsSearching: (v: boolean) => void;
  addRepo: (repo: RepoResult) => void;
  updateRepoVerification: (url: string, verification: Partial<RepoVerification>) => void;
  addSearchProgress: (progress: { strategy: string; status: string; repos_found: number }) => void;
  addObservation: (text: string) => void;
  addCuratedList: (list: { name: string; url: string; description: string }) => void;
  addIndustryTool: (tool: { name: string; description: string; url?: string }) => void;
  setPhase1Complete: (v: boolean) => void;
  toggleRepoSelection: (url: string) => void;
  addDeepDiveResult: (result: DeepDiveResult) => void;
  setSummary: (summary: ScoutSummary) => void;
  setIsDeepDiving: (v: boolean) => void;
  setPhase2Complete: (v: boolean) => void;
  addDeepDiveResultV2: (result: DeepDiveResultV2) => void;
  setSummaryV2: (summary: ScoutSummaryV2) => void;
  setDeepDivePageReady: (ready: boolean) => void;
  reset: () => void;
}

const initialState = {
  searchMeta: null,
  mode: null,
  isSearching: false,
  repos: [],
  searchProgress: [],
  observations: [],
  curatedLists: [],
  industryTools: [],
  phase1Complete: false,
  selectedRepoUrls: [],
  deepDiveResults: [],
  summary: null,
  isDeepDiving: false,
  phase2Complete: false,
  deepDiveResultsV2: [],
  summaryV2: null,
  deepDivePageReady: false,
};

export const useScoutStore = create<ScoutStore>((set) => ({
  ...initialState,

  setSearchMeta: (meta) => set({ searchMeta: meta }),
  setMode: (mode) => set({ mode }),
  setIsSearching: (v) => set({ isSearching: v }),

  addRepo: (repo) => set((s) => ({
    repos: s.repos.some((r) => r.repo_url === repo.repo_url)
      ? s.repos
      : [...s.repos, repo],
  })),

  updateRepoVerification: (url, verification) =>
    set((s) => ({
      repos: s.repos.map((r) =>
        r.repo_url === url
          ? { ...r, verification: { ...r.verification, ...verification } }
          : r
      ),
    })),

  addSearchProgress: (progress) =>
    set((s) => {
      const idx = s.searchProgress.findIndex(
        (p) => p.strategy === progress.strategy
      );
      if (idx >= 0) {
        const updated = [...s.searchProgress];
        updated[idx] = progress;
        return { searchProgress: updated };
      }
      return { searchProgress: [...s.searchProgress, progress] };
    }),

  addObservation: (text) =>
    set((s) => ({ observations: [...s.observations, text] })),
  addCuratedList: (list) =>
    set((s) => ({ curatedLists: [...s.curatedLists, list] })),
  addIndustryTool: (tool) =>
    set((s) => ({ industryTools: [...s.industryTools, tool] })),
  setPhase1Complete: (v) => set({ phase1Complete: v }),

  toggleRepoSelection: (url) =>
    set((s) => {
      const isSelected = s.selectedRepoUrls.includes(url);
      if (isSelected) {
        return {
          selectedRepoUrls: s.selectedRepoUrls.filter((u) => u !== url),
        };
      }
      if (s.selectedRepoUrls.length >= 5) return s;
      return { selectedRepoUrls: [...s.selectedRepoUrls, url] };
    }),

  addDeepDiveResult: (result) =>
    set((s) => ({
      deepDiveResults: s.deepDiveResults.some((r) => r.repo_url === result.repo_url)
        ? s.deepDiveResults
        : [...s.deepDiveResults, result],
    })),

  setSummary: (summary) => set({ summary }),
  setIsDeepDiving: (v) => set({ isDeepDiving: v }),
  setPhase2Complete: (v) => set({ phase2Complete: v }),

  addDeepDiveResultV2: (result) =>
    set((s) => ({
      deepDiveResultsV2: [
        ...s.deepDiveResultsV2.filter((r) => r.repo_url !== result.repo_url),
        result,
      ],
    })),
  setSummaryV2: (summary) => set({ summaryV2: summary }),
  setDeepDivePageReady: (ready) => set({ deepDivePageReady: ready }),

  reset: () => set(initialState),
}));
