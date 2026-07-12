import { describe, expect, test } from "bun:test";
import {
  cookieHeaderForBackend,
  SESSION_COOKIE_NAME,
  sessionCookieFromSetCookie,
  sessionCookieOptions,
} from "./studio-session";

describe("studio admin session boundary", () => {
  test("forwards only the admin session cookie", () => {
    const request = new Request("https://studio.panyakorn.com/api/studio/admin", {
      headers: { cookie: "theme=dark; portfolio_admin_session=secret-session; tracking=yes" },
    });
    expect(cookieHeaderForBackend(request)).toBe(`${SESSION_COOKIE_NAME}=secret-session`);
  });

  test("does not create an authenticated backend request without a session", () => {
    expect(cookieHeaderForBackend(new Request("https://studio.panyakorn.com"))).toBeNull();
  });

  test("extracts the backend session without exposing cookie attributes", () => {
    expect(sessionCookieFromSetCookie("portfolio_admin_session=abc%2F123; Path=/; HttpOnly; SameSite=Lax")).toBe(
      "abc%2F123",
    );
  });

  test("reissues a host-only secure HttpOnly cookie", () => {
    expect(sessionCookieOptions()).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  });
});
