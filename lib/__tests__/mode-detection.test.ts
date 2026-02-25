import { describe, it, expect } from "vitest";
import { detectMode } from "../mode-detection";

describe("detectMode", () => {
  it("detects LEARN mode from learning keywords", () => {
    const result = detectMode("how to learn about AI agents tutorial");
    expect(result.mode).toBe("LEARN");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("detects BUILD mode from builder keywords", () => {
    const result = detectMode("template for building a SaaS app");
    expect(result.mode).toBe("BUILD");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("detects SCOUT mode from scouting keywords", () => {
    const result = detectMode("what alternatives exist for Redis");
    expect(result.mode).toBe("SCOUT");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("returns null mode for ambiguous queries", () => {
    const result = detectMode("python library");
    expect(result.mode).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it("returns null for queries under 3 characters", () => {
    const result = detectMode("hi");
    expect(result.mode).toBeNull();
  });

  it("handles higher confidence with multiple trigger matches", () => {
    const single = detectMode("learn React");
    const multi = detectMode("learn how to study React tutorial");
    expect(multi.confidence).toBeGreaterThan(single.confidence);
  });

  it("returns matched triggers", () => {
    const result = detectMode("how to learn building AI agents");
    expect(result.triggers_matched.length).toBeGreaterThan(0);
  });
});
