import type { StudioExecution } from "./studio-api";

export type ExecutionStageStatus = "pending" | "running" | "completed" | "failed" | "waiting";
export type ExecutionStage = {
  executionId: string;
  position: number;
  name: string;
  status: ExecutionStageStatus;
  detail: string;
  tool?: string;
  metadata: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
};
export type ExecutionSnapshot = { execution: StudioExecution; stages: ExecutionStage[] };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
export function parseExecutionSnapshot(value: unknown): ExecutionSnapshot {
  if (!record(value) || !record(value.execution) || !Array.isArray(value.stages))
    throw new Error("Invalid execution snapshot");
  const execution = value.execution;
  if (
    typeof execution.id !== "string" ||
    typeof execution.workflow !== "string" ||
    !["completed", "running", "failed", "waiting", "paused", "approved", "cancelled"].includes(
      String(execution.status),
    ) ||
    typeof execution.started !== "string" ||
    typeof execution.duration !== "string" ||
    typeof execution.durationMs !== "number" ||
    !Number.isFinite(execution.durationMs) ||
    execution.durationMs < 0 ||
    typeof execution.cost !== "number" ||
    !Number.isFinite(execution.cost) ||
    execution.cost < 0
  )
    throw new Error("Invalid execution snapshot");
  for (const stage of value.stages) {
    if (
      !record(stage) ||
      typeof stage.executionId !== "string" ||
      !Number.isInteger(stage.position) ||
      Number(stage.position) < 0 ||
      typeof stage.name !== "string" ||
      !["pending", "running", "completed", "failed", "waiting"].includes(String(stage.status)) ||
      typeof stage.detail !== "string" ||
      !record(stage.metadata) ||
      typeof stage.updatedAt !== "string" ||
      (stage.tool !== undefined && typeof stage.tool !== "string")
    )
      throw new Error("Invalid execution snapshot");
  }
  return value as ExecutionSnapshot;
}

export function reconnectDelay(attempt: number): number {
  return Math.min(30000, 1000 * 2 ** Math.min(attempt, 5));
}
