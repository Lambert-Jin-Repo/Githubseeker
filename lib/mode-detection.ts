import type { ScoutMode } from "./types";

const MODE_TRIGGERS: Record<ScoutMode, string[]> = {
  LEARN: [
    "learn", "teach", "tutorial", "how to", "how do", "beginner",
    "study", "understand", "skills for", "getting started",
    "explain", "introduction", "course", "education", "practice",
    "training", "master",
  ],
  BUILD: [
    "build", "create", "make", "template", "boilerplate", "scaffold",
    "stack", "implement", "architecture", "starter", "setup",
    "deploy", "production", "project structure", "tech stack",
    "app", "application", "service", "api", "backend",
  ],
  SCOUT: [
    "what exists", "alternatives", "compare", "comparison", "landscape",
    "trending", "overview", "tools for", "options for", "market",
    "competitors", "versus", "vs", "which is better", "what's out there",
    "framework", "library", "toolkit", "sdk", "platform", "tool",
    "agent", "plugin", "package", "module",
  ],
};

export interface ModeDetectionResult {
  mode: ScoutMode | null;
  confidence: number;
  triggers_matched: string[];
}

export function detectMode(query: string): ModeDetectionResult {
  if (query.length < 3) {
    return { mode: null, confidence: 0, triggers_matched: [] };
  }

  const lowerQuery = query.toLowerCase();
  const scores: Record<ScoutMode, { count: number; triggers: string[] }> = {
    LEARN: { count: 0, triggers: [] },
    BUILD: { count: 0, triggers: [] },
    SCOUT: { count: 0, triggers: [] },
  };

  for (const [mode, triggers] of Object.entries(MODE_TRIGGERS) as [ScoutMode, string[]][]) {
    for (const trigger of triggers) {
      if (lowerQuery.includes(trigger)) {
        scores[mode].count++;
        scores[mode].triggers.push(trigger);
      }
    }
  }

  const sorted = (Object.entries(scores) as [ScoutMode, { count: number; triggers: string[] }][])
    .sort((a, b) => b[1].count - a[1].count);

  const [topMode, topScore] = sorted[0];
  const [, secondScore] = sorted[1];

  if (topScore.count === 0) {
    return { mode: null, confidence: 0, triggers_matched: [] };
  }

  if (topScore.count === secondScore.count) {
    return { mode: null, confidence: 0, triggers_matched: [...topScore.triggers, ...secondScore.triggers] };
  }

  const maxPossible = MODE_TRIGGERS[topMode].length;
  const confidence = Math.min(topScore.count / Math.max(maxPossible * 0.3, 1), 1);

  return {
    mode: topMode,
    confidence: Math.round(confidence * 100) / 100,
    triggers_matched: topScore.triggers,
  };
}
