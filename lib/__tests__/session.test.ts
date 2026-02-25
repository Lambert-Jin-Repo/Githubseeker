import { describe, it, expect } from "vitest";
import { generateSessionId, isValidSessionId } from "../session";

describe("Session identity", () => {
  it("generates a valid UUID session ID", () => {
    const id = generateSessionId();
    expect(isValidSessionId(id)).toBe(true);
  });

  it("generates unique IDs", () => {
    const id1 = generateSessionId();
    const id2 = generateSessionId();
    expect(id1).not.toBe(id2);
  });

  it("rejects invalid session IDs", () => {
    expect(isValidSessionId("")).toBe(false);
    expect(isValidSessionId("not-a-uuid")).toBe(false);
    expect(isValidSessionId("12345")).toBe(false);
  });

  it("accepts valid UUID format", () => {
    expect(isValidSessionId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });
});
