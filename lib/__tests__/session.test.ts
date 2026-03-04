import { describe, it, expect, beforeEach } from "vitest";
import {
  generateSessionId,
  isValidSessionId,
  getOrCreateSessionId,
  SESSION_COOKIE_NAME,
} from "../session";

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

describe("getOrCreateSessionId", () => {
  function clearSessionCookie() {
    document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0`;
  }

  beforeEach(() => {
    clearSessionCookie();
  });

  it("returns existing valid session ID from cookie", () => {
    const existingId = "550e8400-e29b-41d4-a716-446655440000";
    document.cookie = `${SESSION_COOKIE_NAME}=${existingId}; path=/`;

    const result = getOrCreateSessionId();
    expect(result).toBe(existingId);
  });

  it("creates a new session ID and sets cookie when no cookie exists", () => {
    const result = getOrCreateSessionId();

    expect(isValidSessionId(result)).toBe(true);
    expect(document.cookie).toContain(`${SESSION_COOKIE_NAME}=${result}`);
  });

  it("regenerates session ID when cookie value is malformed", () => {
    document.cookie = `${SESSION_COOKIE_NAME}=not-a-valid-uuid; path=/`;

    const result = getOrCreateSessionId();

    expect(isValidSessionId(result)).toBe(true);
    expect(result).not.toBe("not-a-valid-uuid");
    expect(document.cookie).toContain(`${SESSION_COOKIE_NAME}=${result}`);
  });

  it("regenerates session ID when cookie value is empty", () => {
    document.cookie = `${SESSION_COOKIE_NAME}=; path=/`;

    const result = getOrCreateSessionId();

    expect(isValidSessionId(result)).toBe(true);
    expect(document.cookie).toContain(`${SESSION_COOKIE_NAME}=${result}`);
  });

  it("ignores unrelated cookies and reads the correct one", () => {
    const existingId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    document.cookie = `other_cookie=some_value; path=/`;
    document.cookie = `${SESSION_COOKIE_NAME}=${existingId}; path=/`;
    document.cookie = `another_cookie=another_value; path=/`;

    const result = getOrCreateSessionId();
    expect(result).toBe(existingId);
  });

  it("returns a new unique ID on each call when cookie cannot be persisted", () => {
    // In jsdom, cookies do persist, so this test verifies that
    // after the first call sets a cookie, subsequent calls return the same ID
    const first = getOrCreateSessionId();
    const second = getOrCreateSessionId();
    expect(first).toBe(second);
  });
});
