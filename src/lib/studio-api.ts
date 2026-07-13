import type { WorkflowDefinitionV1 } from "./workflow-definition";
import type { ExecutionStatus, WorkflowStatus } from "./workflows";

export type StudioWorkflow = {
  id: string;
  name: string;
  description: string;
  category: string;
  status: WorkflowStatus;
  runs: number;
  success: number;
  updated: string;
  nodes: string[];
  definition?: WorkflowDefinitionV1 | null;
};
export type StudioExecution = {
  id: string;
  workflow: string;
  status: ExecutionStatus;
  started: string;
  duration: string;
  durationMs: number;
  cost: number;
};
export type StudioStage = { name: string; detail: string; state: "done" | "running" | "pending" };
export type StudioOverview = {
  workflows: StudioWorkflow[];
  executions: StudioExecution[];
  stages: StudioStage[];
  source: "backend" | "empty";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWorkflow(value: unknown): value is StudioWorkflow {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    typeof value.category === "string" &&
    ["active", "draft", "paused"].includes(String(value.status)) &&
    typeof value.runs === "number" &&
    Number.isFinite(value.runs) &&
    value.runs >= 0 &&
    typeof value.success === "number" &&
    Number.isFinite(value.success) &&
    value.success >= 0 &&
    value.success <= 100 &&
    typeof value.updated === "string" &&
    Array.isArray(value.nodes) &&
    value.nodes.every((node) => typeof node === "string")
  );
}

function isExecution(value: unknown): value is StudioExecution {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.workflow === "string" &&
    ["completed", "running", "failed", "waiting", "paused", "approved", "cancelled"].includes(String(value.status)) &&
    typeof value.started === "string" &&
    typeof value.duration === "string" &&
    typeof value.durationMs === "number" &&
    Number.isFinite(value.durationMs) &&
    value.durationMs >= 0 &&
    typeof value.cost === "number" &&
    Number.isFinite(value.cost) &&
    value.cost >= 0
  );
}

function isStage(value: unknown): value is StudioStage {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.detail === "string" &&
    ["done", "running", "pending"].includes(String(value.state))
  );
}

export function parseStudioOverview(payload: unknown): StudioOverview {
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.data)) {
    throw new Error("Invalid studio overview response");
  }
  const { workflows, executions, stages } = payload.data;
  if (
    !Array.isArray(workflows) ||
    !Array.isArray(executions) ||
    !Array.isArray(stages) ||
    !workflows.every(isWorkflow) ||
    !executions.every(isExecution) ||
    !stages.every(isStage)
  ) {
    throw new Error("Invalid studio overview response");
  }
  return { workflows, executions, stages, source: "backend" };
}

function emptyOverview(): StudioOverview {
  return { workflows: [], executions: [], stages: [], source: "empty" };
}

export async function getStudioOverview(): Promise<StudioOverview> {
  const baseURL = process.env.FRONTEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!baseURL) return emptyOverview();
  try {
    const response = await fetch(`${baseURL.replace(/\/$/, "")}/api/studio/overview`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return emptyOverview();
    return parseStudioOverview(await response.json());
  } catch {
    return emptyOverview();
  }
}
