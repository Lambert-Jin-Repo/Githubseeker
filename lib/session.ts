import { v4 as uuidv4 } from "uuid";

const SESSION_COOKIE_NAME = "github_scout_session";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function generateSessionId(): string {
  return uuidv4();
}

export function isValidSessionId(id: string): boolean {
  return UUID_REGEX.test(id);
}

export function getOrCreateSessionId(): string {
  if (typeof document === "undefined") return generateSessionId();

  const cookies = document.cookie.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((c) =>
    c.startsWith(`${SESSION_COOKIE_NAME}=`)
  );

  if (sessionCookie) {
    const id = sessionCookie.split("=")[1];
    if (isValidSessionId(id)) return id;
  }

  const newId = generateSessionId();
  document.cookie = `${SESSION_COOKIE_NAME}=${newId}; path=/; max-age=${60 * 60 * 24 * 90}; SameSite=Lax`;
  return newId;
}
