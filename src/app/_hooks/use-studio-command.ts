"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StudioAdminCommand } from "@/lib/studio-admin";

export function useStudioCommand() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function run(command: StudioAdminCommand) {
    setPending(command.action); setMessage(null);
    try {
      const response = await fetch("/api/studio/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || "Studio action failed.");
      setMessage(`${command.action} completed`); router.refresh(); return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Studio action failed."); return false; }
    finally { setPending(null); }
  }
  return { run, pending, message };
}
