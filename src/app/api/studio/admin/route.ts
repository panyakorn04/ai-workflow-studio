import { NextResponse } from "next/server";
import { type StudioAdminCommand, studioAdminTarget } from "@/lib/studio-admin";
import { cookieHeaderForBackend, studioBackendURL } from "@/lib/studio-session";

function validBoundedString(value: unknown, maximum = 128) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function validOptionalBoundedString(value: unknown, maximum = 128) {
  return value === undefined || validBoundedString(value, maximum);
}

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
    "execute-previous",
    "get-execution",
    "delete-workflow",
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
    "get-execution",
    "delete-workflow",
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
      (!validBoundedString(command.workflowId) ||
        !validOptionalBoundedString(command.triggerNodeId) ||
        !validOptionalBoundedString(command.sourceKey, 160))) ||
    ((command.action === "execute-node" ||
      command.action === "execute-http-request" ||
      command.action === "execute-previous") &&
      (!validBoundedString(command.workflowId) ||
        !validBoundedString(command.nodeId) ||
        (command.action === "execute-previous" &&
          (!validOptionalBoundedString(command.triggerNodeId) || !validOptionalBoundedString(command.sourceKey, 160)))))
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
