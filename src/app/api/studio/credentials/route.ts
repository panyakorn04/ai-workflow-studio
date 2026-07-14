import { NextResponse } from "next/server";
import { cookieHeaderForBackend, studioBackendURL } from "@/lib/studio-session";

export async function GET(request: Request) {
  const sessionCookie = cookieHeaderForBackend(request);
  if (!sessionCookie) {
    return NextResponse.json({ ok: false, error: { message: "Admin sign-in required." } }, { status: 401 });
  }
  const target = studioBackendURL("/api/admin/studio/credentials");
  if (!target) {
    return NextResponse.json({ ok: false, error: { message: "Studio controls are not configured." } }, { status: 503 });
  }
  try {
    const response = await fetch(target, {
      headers: { Cookie: sessionCookie, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response
      .json()
      .catch(() => ({ ok: false, error: { message: "Backend returned an invalid response." } }));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ ok: false, error: { message: "Studio controls are unavailable." } }, { status: 502 });
  }
}
