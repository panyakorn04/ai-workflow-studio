import { NextResponse } from "next/server";
import { type StudioAdminCommand, studioAdminTarget } from "@/lib/studio-admin";
import { cookieHeaderForBackend, studioBackendURL } from "@/lib/studio-session";

export async function POST(request: Request) {
  const sessionCookie = cookieHeaderForBackend(request);
  if (!sessionCookie) {
    return NextResponse.json({ ok: false, error: { message: "Admin sign-in required." } }, { status: 401 });
  }

  let command: StudioAdminCommand;
  try {
    command = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: { message: "Invalid command." } }, { status: 400 });
  }
  const allowed = new Set([
    "pause",
    "retry",
    "cancel",
    "approve",
    "create-execution",
    "create-workflow",
    "update-workflow",
  ]);
  if (
    !command ||
    typeof command !== "object" ||
    !allowed.has(command.action) ||
    ("id" in command && typeof command.id !== "string") ||
    (command.action === "create-execution" &&
      (!("workflowId" in command) || typeof command.workflowId !== "string" || !command.workflowId.trim()))
  ) {
    return NextResponse.json({ ok: false, error: { message: "Unsupported command." } }, { status: 400 });
  }

  const target = studioAdminTarget(command);
  const url = studioBackendURL(target.path);
  if (!url) {
    return NextResponse.json({ ok: false, error: { message: "Studio controls are not configured." } }, { status: 503 });
  }

  try {
    const response = await fetch(url, {
      method: target.method,
      headers: { Cookie: sessionCookie, "Content-Type": "application/json" },
      body: target.body ? JSON.stringify(target.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const data = await response
      .json()
      .catch(() => ({ ok: false, error: { message: "Backend returned an invalid response." } }));
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ ok: false, error: { message: "Studio controls are unavailable." } }, { status: 502 });
  }
}
