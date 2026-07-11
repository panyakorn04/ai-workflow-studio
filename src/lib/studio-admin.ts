export type StudioAdminCommand =
  | { action: "pause" | "retry" | "cancel" | "approve"; id: string }
  | { action: "create-execution"; workflowId: string }
  | { action: "create-workflow"; payload: { name: string; description: string; category: string; status: string; nodes: string[] } }
  | { action: "update-workflow"; id: string; payload: { name: string; description: string; category: string; status: string; nodes: string[] } };

export function studioAdminTarget(command: StudioAdminCommand) {
  if (command.action === "create-execution") return { method: "POST", path: "/api/admin/studio/executions", body: { workflowId: command.workflowId } };
  if (command.action === "create-workflow") return { method: "POST", path: "/api/admin/studio/workflows", body: command.payload };
  if (command.action === "update-workflow") return { method: "PATCH", path: `/api/admin/studio/workflows/${encodeURIComponent(command.id)}`, body: command.payload };
  if ("id" in command) return { method: "POST", path: `/api/admin/studio/executions/${encodeURIComponent(command.id)}/${command.action}`, body: undefined };
  throw new Error("Unsupported Studio command");
}
