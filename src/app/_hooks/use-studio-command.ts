"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StudioAdminCommand } from "@/lib/studio-admin";

export function useStudioCommand(authenticated: boolean, onUnauthorized: () => void) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function run(command: StudioAdminCommand) {
    if (!authenticated) {
      setMessage("Admin sign-in required.");
      return false;
    }
    setPending(command.action === "create-execution" ? `create-execution:${command.workflowId}` : command.action);
    setMessage(null);
    try {
      const response = await fetch("/api/studio/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      const result = await response.json();
      if (response.status === 401) onUnauthorized();
      if (!response.ok) throw new Error(result?.error?.message || "Studio action failed.");
      setMessage(`${command.action} completed`);
      router.refresh();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Studio action failed.");
      return false;
    } finally {
      setPending(null);
    }
  }
  return { run, pending, message };
}
