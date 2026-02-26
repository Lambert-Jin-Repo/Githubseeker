import { describe, it, expect } from "vitest";
import { getClientIp } from "../auth";
import type { OAuthProvider } from "../auth";

describe("OAuthProvider type", () => {
  it("accepts google as a valid provider", () => {
    const provider: OAuthProvider = "google";
    expect(provider).toBe("google");
  });

  it("accepts github as a valid provider", () => {
    const provider: OAuthProvider = "github";
    expect(provider).toBe("github");
  });

  it("accepts azure as a valid provider", () => {
    const provider: OAuthProvider = "azure";
    expect(provider).toBe("azure");
  });
});

describe("getClientIp", () => {
  it("extracts IP from x-forwarded-for header", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.50" });
    expect(getClientIp(headers)).toBe("203.0.113.50");
  });

  it("extracts first IP from x-forwarded-for with multiple IPs", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.50, 70.41.3.18, 150.172.238.178",
    });
    expect(getClientIp(headers)).toBe("203.0.113.50");
  });

  it("trims whitespace from x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "  203.0.113.50  , 70.41.3.18",
    });
    expect(getClientIp(headers)).toBe("203.0.113.50");
  });

  it("extracts IP from cf-connecting-ip header", () => {
    const headers = new Headers({ "cf-connecting-ip": "198.51.100.23" });
    expect(getClientIp(headers)).toBe("198.51.100.23");
  });

  it("extracts IP from x-real-ip header", () => {
    const headers = new Headers({ "x-real-ip": "192.0.2.1" });
    expect(getClientIp(headers)).toBe("192.0.2.1");
  });

  it("prefers x-forwarded-for over cf-connecting-ip", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.50",
      "cf-connecting-ip": "198.51.100.23",
    });
    expect(getClientIp(headers)).toBe("203.0.113.50");
  });

  it("prefers cf-connecting-ip over x-real-ip", () => {
    const headers = new Headers({
      "cf-connecting-ip": "198.51.100.23",
      "x-real-ip": "192.0.2.1",
    });
    expect(getClientIp(headers)).toBe("198.51.100.23");
  });

  it("returns 'unknown' when no IP headers are present", () => {
    const headers = new Headers();
    expect(getClientIp(headers)).toBe("unknown");
  });

  it("returns 'unknown' when only unrelated headers are present", () => {
    const headers = new Headers({
      "content-type": "application/json",
      authorization: "Bearer token",
    });
    expect(getClientIp(headers)).toBe("unknown");
  });
});
