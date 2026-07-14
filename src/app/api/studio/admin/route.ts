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
    "execute-node",
    "execute-http-request",
    "import-curl",
    "create-credential",
    "update-credential",
    "delete-credential",
    "test-credential",
    "create-workflow",
    "update-workflow",
  ]);
  const idActions = new Set([
    "pause",
    "retry",
    "cancel",
    "approve",
    "update-workflow",
    "update-credential",
    "delete-credential",
    "test-credential",
  ]);
  const payloadActions = new Set(["create-workflow", "update-workflow", "create-credential", "update-credential"]);
  if (
    !command ||
    typeof command !== "object" ||
    !allowed.has(command.action) ||
    (idActions.has(command.action) &&
      (!("id" in command) || typeof command.id !== "string" || !command.id.trim() || command.id.length > 128)) ||
    (payloadActions.has(command.action) &&
      (!("payload" in command) ||
        typeof command.payload !== "object" ||
        command.payload === null ||
        Array.isArray(command.payload))) ||
    (command.action === "import-curl" &&
      (!("command" in command) ||
        typeof command.command !== "string" ||
        !command.command.trim() ||
        command.command.length > 16384)) ||
    (command.action === "create-execution" &&
      (!("workflowId" in command) || typeof command.workflowId !== "string" || !command.workflowId.trim())) ||
    ((command.action === "execute-node" || command.action === "execute-http-request") &&
      (!("workflowId" in command) ||
        typeof command.workflowId !== "string" ||
        !command.workflowId.trim() ||
        !("nodeId" in command) ||
        typeof command.nodeId !== "string" ||
        !command.nodeId.trim()))
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
      signal: AbortSignal.timeout(command.action === "execute-http-request" ? 35000 : 10000),
    });
    const data = await response
      .json()
      .catch(() => ({ ok: false, error: { message: "Backend returned an invalid response." } }));
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ ok: false, error: { message: "Studio controls are unavailable." } }, { status: 502 });
  }
}
