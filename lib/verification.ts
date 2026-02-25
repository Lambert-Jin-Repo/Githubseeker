import type { RepoVerification, FreshnessStatus, VerificationLevel } from "./types";

export type OverallStatus = "fully_verified" | "partially_verified" | "unverified";

export function getOverallVerificationStatus(v: RepoVerification): OverallStatus {
  if (v.existence.status === "dead") return "unverified";

  const levels: VerificationLevel[] = [
    v.stars.level,
    v.last_commit.level,
    v.language.level,
    v.license.level,
    v.freshness.level,
  ];

  const allVerified = levels.every((l) => l === "verified");
  if (allVerified && v.existence.status === "live") return "fully_verified";

  const someVerified = levels.some((l) => l === "verified");
  if (someVerified) return "partially_verified";

  return "unverified";
}

export function getFreshnessStatus(lastCommitDate: string): FreshnessStatus {
  const commitDate = new Date(lastCommitDate);
  const now = new Date();
  const monthsAgo = (now.getTime() - commitDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

  if (monthsAgo <= 6) return "active";
  if (monthsAgo <= 18) return "stale";
  return "archived";
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function formatStarCount(stars: number): string {
  if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`;
  return stars.toString();
}
