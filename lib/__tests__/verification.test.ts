import { describe, it, expect } from "vitest";
import { getOverallVerificationStatus, getFreshnessStatus, formatRelativeDate, formatStarCount } from "../verification";

describe("getOverallVerificationStatus", () => {
  it("returns fully_verified when all layers are verified", () => {
    const verification = {
      existence: { status: "live" as const, checked_at: new Date().toISOString() },
      stars: { value: 1000, level: "verified" as const, source: "github" },
      last_commit: { value: "2026-02-01", level: "verified" as const },
      language: { value: "TypeScript", level: "verified" as const },
      license: { value: "MIT", level: "verified" as const },
      freshness: { status: "active" as const, level: "verified" as const },
      community: { signal: "validated" as const, level: "verified" as const },
    };
    expect(getOverallVerificationStatus(verification)).toBe("fully_verified");
  });

  it("returns partially_verified when some layers are unverified", () => {
    const verification = {
      existence: { status: "live" as const, checked_at: new Date().toISOString() },
      stars: { value: 1000, level: "verified" as const, source: "github" },
      last_commit: { value: "2026-02-01", level: "unverified" as const },
      language: { value: "TypeScript", level: "verified" as const },
      license: { value: "MIT", level: "unverified" as const },
      freshness: { status: "active" as const, level: "verified" as const },
      community: { signal: "no_data" as const, level: "unverified" as const },
    };
    expect(getOverallVerificationStatus(verification)).toBe("partially_verified");
  });

  it("returns unverified when existence is dead", () => {
    const verification = {
      existence: { status: "dead" as const, checked_at: new Date().toISOString() },
      stars: { value: 0, level: "unverified" as const, source: "" },
      last_commit: { value: "", level: "unverified" as const },
      language: { value: "", level: "unverified" as const },
      license: { value: "", level: "unverified" as const },
      freshness: { status: "archived" as const, level: "unverified" as const },
      community: { signal: "no_data" as const, level: "unverified" as const },
    };
    expect(getOverallVerificationStatus(verification)).toBe("unverified");
  });
});

describe("getFreshnessStatus", () => {
  it("returns active for recent commits", () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 2);
    expect(getFreshnessStatus(recent.toISOString())).toBe("active");
  });

  it("returns stale for 6-18 month old commits", () => {
    const stale = new Date();
    stale.setMonth(stale.getMonth() - 12);
    expect(getFreshnessStatus(stale.toISOString())).toBe("stale");
  });

  it("returns archived for > 18 month old commits", () => {
    const old = new Date();
    old.setMonth(old.getMonth() - 24);
    expect(getFreshnessStatus(old.toISOString())).toBe("archived");
  });
});

describe("formatRelativeDate", () => {
  it("returns 'today' for today", () => {
    expect(formatRelativeDate(new Date().toISOString())).toBe("today");
  });

  it("returns weeks for 7-29 days", () => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    expect(formatRelativeDate(d.toISOString())).toBe("2 weeks ago");
  });
});

describe("formatStarCount", () => {
  it("formats thousands", () => {
    expect(formatStarCount(12300)).toBe("12.3k");
  });

  it("keeps small numbers as-is", () => {
    expect(formatStarCount(500)).toBe("500");
  });
});
