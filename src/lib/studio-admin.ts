import type { WorkflowDefinitionV1 } from "./workflow-definition";

type StudioWorkflowPayload = {
  name: string;
  description: string;
  category: string;
  status: string;
  nodes: string[];
  definition?: WorkflowDefinitionV1;
};

export type StudioCredentialType = "bearer" | "basic" | "header" | "query";
export type StudioCredential = {
  id: string;
  name: string;
  type: StudioCredentialType;
  status?: "active" | "revoked";
  createdAt: string;
  updatedAt: string;
};

export type StudioGraphExecution = {
  id: string;
  workflowId: string;
  workflow: string;
  status: "queued" | "running" | "cancellation_requested" | "completed" | "failed" | "cancelled";
  triggerNodeId?: string;
  targetNodeId?: string;
  mode?: "full" | "through-target";
  errorCode?: string;
  errorMessage?: string;
};

export type StudioGraphExecutionStage = {
  executionId: string;
  position: number;
  nodeId: string;
  nodeType: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled";
  input?: unknown[];
  output?: unknown[];
  errorCode?: string;
  errorMessage?: string;
  durationMs: number;
};

export type StudioGraphExecutionDetail = { execution: StudioGraphExecution; stages: StudioGraphExecutionStage[] };
export type StudioCredentialPayload = {
  name: string;
  type: StudioCredentialType;
  data: Record<string, string>;
};

export type StudioAdminCommand =
  | { action: "pause" | "retry" | "cancel" | "approve"; id: string }
  | { action: "create-execution"; workflowId: string; triggerNodeId?: string; sourceKey?: string }
  | { action: "execute-node" | "execute-http-request"; workflowId: string; nodeId: string }
  | { action: "execute-previous"; workflowId: string; nodeId: string; triggerNodeId?: string; sourceKey?: string }
  | { action: "get-execution"; id: string }
  | { action: "delete-workflow"; id: string }
  | { action: "import-curl"; command: string }
  | { action: "create-credential"; payload: StudioCredentialPayload }
  | { action: "update-credential"; id: string; payload: StudioCredentialPayload }
  | { action: "delete-credential" | "test-credential"; id: string }
  | { action: "create-workflow"; payload: StudioWorkflowPayload }
  | { action: "update-workflow"; id: string; payload: StudioWorkflowPayload };

export function studioAdminTarget(command: StudioAdminCommand) {
  if (command.action === "create-execution")
    return {
      method: "POST",
      path: "/api/admin/studio/executions",
      body: {
        workflowId: command.workflowId,
        triggerNodeId: command.triggerNodeId,
        sourceKey: command.sourceKey,
      },
    };
  if (command.action === "execute-previous")
    return {
      method: "POST",
      path: `/api/admin/studio/workflows/${encodeURIComponent(command.workflowId)}/nodes/${encodeURIComponent(command.nodeId)}/execute-previous`,
      body: { triggerNodeId: command.triggerNodeId, sourceKey: command.sourceKey },
    };
  if (command.action === "get-execution")
    return {
      method: "GET",
      path: `/api/admin/studio/executions/${encodeURIComponent(command.id)}`,
      body: undefined,
    };
  if (command.action === "delete-workflow")
    return {
      method: "DELETE",
      path: `/api/admin/studio/workflows/${encodeURIComponent(command.id)}`,
      body: undefined,
    };
  if (command.action === "execute-node")
    return {
      method: "POST",
      path: `/api/admin/studio/workflows/${encodeURIComponent(command.workflowId)}/nodes/${encodeURIComponent(command.nodeId)}/execute`,
      body: undefined,
    };
  if (command.action === "execute-http-request")
    return {
      method: "POST",
      path: `/api/admin/studio/workflows/${encodeURIComponent(command.workflowId)}/nodes/${encodeURIComponent(command.nodeId)}/http-request`,
      body: undefined,
    };
  if (command.action === "import-curl")
    return { method: "POST", path: "/api/admin/studio/http-request/import-curl", body: { command: command.command } };
  if (command.action === "create-credential")
    return { method: "POST", path: "/api/admin/studio/credentials", body: command.payload };
  if (command.action === "update-credential")
    return {
      method: "PATCH",
      path: `/api/admin/studio/credentials/${encodeURIComponent(command.id)}`,
      body: command.payload,
    };
  if (command.action === "delete-credential")
    return {
      method: "DELETE",
      path: `/api/admin/studio/credentials/${encodeURIComponent(command.id)}`,
      body: undefined,
    };
  if (command.action === "test-credential")
    return {
      method: "POST",
      path: `/api/admin/studio/credentials/${encodeURIComponent(command.id)}/test`,
      body: undefined,
    };
  if (command.action === "create-workflow")
    return { method: "POST", path: "/api/admin/studio/workflows", body: command.payload };
  if (command.action === "update-workflow")
    return {
      method: "PATCH",
      path: `/api/admin/studio/workflows/${encodeURIComponent(command.id)}`,
      body: command.payload,
    };
  if ("id" in command)
    return {
      method: "POST",
      path: `/api/admin/studio/executions/${encodeURIComponent(command.id)}/${command.action}`,
      body: undefined,
    };
  throw new Error("Unsupported Studio command");
}

export function parseStudioGraphExecutionDetail(value: unknown): StudioGraphExecutionDetail {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid execution response.");
  const detail = value as Record<string, unknown>;
  if (!detail.execution || typeof detail.execution !== "object" || !Array.isArray(detail.stages))
    throw new Error("Invalid execution response.");
  const execution = detail.execution as Record<string, unknown>;
  const executionStatuses = ["queued", "running", "cancellation_requested", "completed", "failed", "cancelled"];
  if (
    typeof execution.id !== "string" ||
    typeof execution.workflowId !== "string" ||
    typeof execution.workflow !== "string" ||
    !executionStatuses.includes(String(execution.status))
  )
    throw new Error("Invalid execution response.");
  const stageStatuses = ["pending", "running", "completed", "failed", "skipped", "cancelled"];
  for (const valueStage of detail.stages) {
    if (!valueStage || typeof valueStage !== "object" || Array.isArray(valueStage))
      throw new Error("Invalid execution response.");
    const stage = valueStage as Record<string, unknown>;
    if (
      typeof stage.executionId !== "string" ||
      typeof stage.position !== "number" ||
      typeof stage.nodeId !== "string" ||
      typeof stage.nodeType !== "string" ||
      typeof stage.name !== "string" ||
      !stageStatuses.includes(String(stage.status)) ||
      typeof stage.durationMs !== "number" ||
      (stage.input !== undefined && !Array.isArray(stage.input)) ||
      (stage.output !== undefined && !Array.isArray(stage.output))
    )
      throw new Error("Invalid execution response.");
  }
  return detail as unknown as StudioGraphExecutionDetail;
}
