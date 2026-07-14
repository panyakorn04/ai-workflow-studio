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
  createdAt: string;
  updatedAt: string;
};
export type StudioCredentialPayload = {
  name: string;
  type: StudioCredentialType;
  data: Record<string, string>;
};

export type StudioAdminCommand =
  | { action: "pause" | "retry" | "cancel" | "approve"; id: string }
  | { action: "create-execution"; workflowId: string }
  | { action: "execute-node" | "execute-http-request"; workflowId: string; nodeId: string }
  | { action: "import-curl"; command: string }
  | { action: "create-credential"; payload: StudioCredentialPayload }
  | { action: "update-credential"; id: string; payload: StudioCredentialPayload }
  | { action: "delete-credential" | "test-credential"; id: string }
  | { action: "create-workflow"; payload: StudioWorkflowPayload }
  | { action: "update-workflow"; id: string; payload: StudioWorkflowPayload };

export function studioAdminTarget(command: StudioAdminCommand) {
  if (command.action === "create-execution")
    return { method: "POST", path: "/api/admin/studio/executions", body: { workflowId: command.workflowId } };
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
