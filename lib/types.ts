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

// ===== Deep Dive V2 =====
export interface SourceLink {
  label: string;
  url: string;
}

export interface EnhancedSection {
  title: string;
  content: string;
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

export interface CodeQuality {
  has_tests: boolean;
  test_framework: string | null;
  has_ci: boolean;
  ci_platform: string | null;
  ci_config_url: string | null;
  has_linting: boolean;
  linter: string | null;
  typescript_strict: boolean | null;
  code_coverage_mentioned: boolean;
  build_system: string | null;
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

export interface CommunityHealth {
  open_issues: number | null;
  closed_issues: number | null;
  contributors: number | null;
  last_commit_days_ago: number | null;
  has_contributing_guide: boolean;
  has_code_of_conduct: boolean;
  bus_factor_estimate: "low" | "medium" | "high";
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

export interface DocumentationQuality {
  readme_sections: string[];
  has_docs_directory: boolean;
  has_api_docs: boolean;
  api_docs_type: string | null;
  has_examples: boolean;
  has_changelog: boolean;
  has_tutorials: boolean;
  overall_grade: "comprehensive" | "adequate" | "minimal" | "missing";
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

export interface SecurityPosture {
  has_security_policy: boolean;
  has_env_example: boolean;
  env_vars_documented: boolean;
  license_type: string;
  license_commercial_friendly: boolean;
  known_vulnerabilities_mentioned: boolean;
  auth_patterns: string[];
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

export interface GettingStarted {
  prerequisites: string[];
  install_commands: string[];
  first_run_command: string | null;
  env_setup_steps: string[];
  common_pitfalls: string[];
  estimated_setup_time: string | null;
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

export interface AgentEcosystemDiscovery {
  discovered_files: Array<{
    type: "cursorrules" | "mcp_config" | "claude_skills" | "agents_config" | "other";
    path: string;
    url: string;
    summary: string;
  }>;
  ecosystem_mapping: {
    cursor: { has_config: boolean; rules_count: number };
    claude: { has_skills: boolean; has_mcp: boolean };
    other_agents: string[];
  };
  trending_tools: Array<{
    name: string;
    relevance: string;
    url?: string;
  }>;
  confidence: "high" | "medium" | "low";
  sources: SourceLink[];
}

export interface DeepDiveResultV2 {
  repo_url: string;
  repo_name: string;
  stars: number;
  contributors: number | null;
  license: string;
  primary_language: string;
  last_updated: string;
  overview: EnhancedSection;
  why_it_stands_out: EnhancedSection;
  tech_stack: {
    languages: string[];
    frameworks: Array<{ name: string; version?: string; url?: string }>;
    infrastructure: string[];
    key_dependencies: Array<{ name: string; version?: string; url?: string }>;
    confidence: "high" | "medium" | "low";
    sources: SourceLink[];
  };
  architecture: EnhancedSection;
  code_quality: CodeQuality;
  community_health: CommunityHealth;
  documentation_quality: DocumentationQuality;
  security_posture: SecurityPosture;
  ai_patterns: AIPatterns & { sources: SourceLink[] };
  skills_required: {
    technical: string[];
    design: string[];
    domain: string[];
  };
  agent_ecosystem: AgentEcosystemDiscovery;
  getting_started: GettingStarted;
  mode_specific: EnhancedSection;
}

export interface ScoutSummaryV2 {
  takeaways: string[];
  recommendation: {
    repo: string;
    repo_url: string;
    reason: string;
    mode: "learn" | "build" | "scout";
  };
  comparative_matrix: {
    dimensions: string[];
    repos: Array<{
      repo_name: string;
      values: Record<string, string>;
    }>;
  };
  skills_roadmap: Array<{
    step: number;
    skill: string;
    description: string;
  }>;
  ecosystem_gaps: Array<{
    gap: string;
    opportunity: string;
  }>;
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
  | { type: "deep_dive_complete_v2"; data: DeepDiveResultV2 }
  | { type: "summary_v2"; data: ScoutSummaryV2 }
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
