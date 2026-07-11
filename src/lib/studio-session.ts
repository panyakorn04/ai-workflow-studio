export const SESSION_COOKIE_NAME = "portfolio_admin_session";

export function cookieHeaderForBackend(request: Request): string | null {
  const rawCookie = request.headers.get("cookie");
  if (!rawCookie) return null;
  const session = rawCookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  return session || null;
}

export function sessionCookieFromSetCookie(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|,\\s*)${SESSION_COOKIE_NAME}=([^;]*)`));
  return match?.[1] || null;
}

export function sessionCookieOptions() {
  return { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
}

export function studioBackendURL(path: string): string | null {
  const baseURL = process.env.FRONTEND_API_BASE_URL;
  return baseURL ? `${baseURL.replace(/\/$/, "")}${path}` : null;
}
