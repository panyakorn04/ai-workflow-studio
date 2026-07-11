import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  cookieHeaderForBackend,
  sessionCookieFromSetCookie,
  sessionCookieOptions,
  studioBackendURL,
} from "@/lib/studio-session";

const SESSION_PATH = "/api/admin/session";

async function proxySession(request: Request, method: "GET" | "POST" | "DELETE") {
  const target = studioBackendURL(SESSION_PATH);
  if (!target) {
    return NextResponse.json({ ok: false, error: { message: "Admin sign-in is not configured." } }, { status: 503 });
  }

  const headers = new Headers({ Accept: "application/json" });
  const sessionCookie = cookieHeaderForBackend(request);
  if (sessionCookie) headers.set("Cookie", sessionCookie);
  let body: string | undefined;
  if (method === "POST") {
    headers.set("Content-Type", "application/json");
    body = await request.text();
  }

  try {
    const backend = await fetch(target, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const payload = await backend.json().catch(() => ({ ok: false, error: { message: "Backend returned an invalid response." } }));
    const response = NextResponse.json(payload, { status: backend.status });

    if (method === "POST" && backend.ok) {
      const token = sessionCookieFromSetCookie(backend.headers.get("set-cookie"));
      if (!token) {
        return NextResponse.json({ ok: false, error: { message: "Sign-in did not create a session." } }, { status: 502 });
      }
      response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    }
    if (method === "DELETE") {
      response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
    }
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: { message: "Admin service is unavailable." } }, { status: 502 });
  }
}

export function GET(request: Request) { return proxySession(request, "GET"); }
export function POST(request: Request) { return proxySession(request, "POST"); }
export function DELETE(request: Request) { return proxySession(request, "DELETE"); }
