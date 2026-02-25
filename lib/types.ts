// ===== Enums =====
export type ScoutMode = "LEARN" | "BUILD" | "SCOUT";
export type VerificationLevel = "verified" | "inferred" | "unverified" | "stale" | "conflicting";
export type FreshnessStatus = "active" | "stale" | "archived";
export type RedditSignal = "validated" | "mixed" | "no_data";
export type QualityTier = 1 | 2 | 3;
export type FeedbackSignal = "useful" | "not_useful" | "inaccurate";

// ===== Search =====
export interface ScoutConfig {
  min_stars: number;
  recency_months: number;
  reddit_validation: boolean;
  max_results: number;
}

export interface ScoutRequest {
  query: string;
  mode?: ScoutMode;
  config?: Partial<ScoutConfig>;
}

export interface SearchMeta {
  id: string;
  query: string;
  mode: ScoutMode;
  topic_extracted: string;
  searches_performed: number;
  repos_evaluated: number;
  repos_verified: number;
  created_at: string;
}

// ===== Repository =====
export interface RepoVerification {
  existence: { status: "live" | "dead" | "redirect"; checked_at: string };
  stars: { value: number; level: VerificationLevel; source: string };
  last_commit: { value: string; level: VerificationLevel };
  language: { value: string; level: VerificationLevel };
  license: { value: string; level: VerificationLevel };
  freshness: { status: FreshnessStatus; level: VerificationLevel };
  community: { signal: RedditSignal; level: VerificationLevel; details?: string };
  readme_quality?: { score: number; level: VerificationLevel };
}

export interface RepoResult {
  repo_url: string;
  repo_name: string;
  stars: number | null;
  last_commit: string | null;
  primary_language: string | null;
  license: string | null;
  quality_tier: QualityTier;
  verification: RepoVerification;
  reddit_signal: RedditSignal;
  summary: string;
  source_strategies: string[];
  is_selected: boolean;
}

// ===== Deep Dive =====
export interface AIPatterns {
  has_ai_components: boolean;
  sdks_detected: string[];
  agent_architecture: string | null;
  skill_files: string[];
  mcp_usage: boolean;
  prompt_engineering: {
    has_system_prompts: boolean;
    has_few_shot: boolean;
    prompt_location: string | null;
  };
  confidence: "high" | "medium" | "low";
  summary: string;
}

export interface DeepDiveSection {
  title: string;
  content: string;
  confidence: "high" | "medium" | "low";
  source?: string;
}

export interface DeepDiveResult {
  repo_url: string;
  repo_name: string;
  stars: number;
  contributors: number | null;
  license: string;
  primary_language: string;
  last_updated: string;
  what_it_does: DeepDiveSection;
  why_it_stands_out: DeepDiveSection;
  tech_stack: {
    languages: string[];
    frameworks: string[];
    infrastructure: string[];
    key_dependencies: string[];
    confidence: "high" | "medium" | "low";
  };
  architecture: DeepDiveSection;
  ai_patterns: AIPatterns;
  skills_required: {
    technical: string[];
    design: string[];
    domain: string[];
  };
  mode_specific: DeepDiveSection;
}

export interface ScoutSummary {
  takeaways: string[];
  recommendations: {
    learning?: { repo: string; reason: string };
    building?: { repo: string; reason: string };
    scouting?: { insight: string };
  };
  skills_roadmap: string[];
  gaps_discovered: string[];
  ai_ecosystem_notes: string;
}

// ===== SSE Events =====
export type SSEEvent =
  | { type: "mode_detected"; data: { mode: ScoutMode; topic: string; confidence: number } }
  | { type: "search_progress"; data: { strategy: string; status: "running" | "complete"; repos_found: number } }
  | { type: "repo_discovered"; data: RepoResult }
  | { type: "verification_update"; data: { repo_url: string; verification: Partial<RepoVerification> } }
  | { type: "observation"; data: { text: string } }
  | { type: "curated_list"; data: { name: string; url: string; description: string } }
  | { type: "industry_tool"; data: { name: string; description: string; url?: string } }
  | { type: "phase1_complete"; data: { total_repos: number; verified: number; unverified: number } }
  | { type: "deep_dive_start"; data: { repo_url: string; index: number; total: number } }
  | { type: "deep_dive_section"; data: { repo_url: string; section: string; content: unknown } }
  | { type: "deep_dive_complete"; data: DeepDiveResult }
  | { type: "summary"; data: ScoutSummary }
  | { type: "error"; data: { message: string; recoverable: boolean } };

// ===== History =====
export interface SearchHistoryItem {
  id: string;
  query: string;
  mode: ScoutMode;
  repos_found: number;
  created_at: string;
  phase2_complete: boolean;
}

// ===== Feedback =====
export interface FeedbackRequest {
  search_id: string;
  repo_url: string;
  signal: FeedbackSignal;
  comment?: string;
}
