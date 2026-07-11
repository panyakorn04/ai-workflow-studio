import { NextResponse } from "next/server";
import { studioAdminTarget, type StudioAdminCommand } from "@/lib/studio-admin";

export async function POST(request: Request) {
  const baseURL = process.env.FRONTEND_API_BASE_URL;
  const token = process.env.STUDIO_ADMIN_API_TOKEN;
  if (!baseURL || !token) return NextResponse.json({ ok: false, error: { message: "Studio controls are not configured." } }, { status: 503 });
  let command: StudioAdminCommand;
  try { command = await request.json(); } catch { return NextResponse.json({ ok: false, error: { message: "Invalid command." } }, { status: 400 }); }
  const allowed = new Set(["pause", "retry", "cancel", "approve", "create-workflow", "update-workflow"]);
  if (!command || typeof command !== "object" || !allowed.has(command.action) || ("id" in command && typeof command.id !== "string")) {
    return NextResponse.json({ ok: false, error: { message: "Unsupported command." } }, { status: 400 });
  }
  const target = studioAdminTarget(command);
  const response = await fetch(`${baseURL.replace(/\/$/, "")}${target.path}`, {
    method: target.method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: target.body ? JSON.stringify(target.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({ ok: false, error: { message: "Backend returned an invalid response." } }));
  return NextResponse.json(data, { status: response.status });
}
