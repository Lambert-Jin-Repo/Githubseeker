export type OAuthProvider = "google" | "github" | "azure";

export function getClientIp(headers: Headers): string {
  const xForwardedFor = headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }

  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  const xRealIp = headers.get("x-real-ip");
  if (xRealIp) return xRealIp;

  return "unknown";
}
