import { describe, expect, test } from "bun:test";
import { parseStudioGraphExecutionDetail, studioAdminTarget } from "./studio-admin";

describe("studio admin command mapping", () => {
  test("maps only known execution actions", () => {
    expect(studioAdminTarget({ action: "pause", id: "RUN/1" })).toEqual({
      method: "POST",
      path: "/api/admin/studio/executions/RUN%2F1/pause",
      body: undefined,
    });
  });
  test("maps workflow creation", () => {
    const payload = { name: "Flow", description: "", category: "Ops", status: "draft", nodes: ["Start"] };
    expect(studioAdminTarget({ action: "create-workflow", payload })).toEqual({
      method: "POST",
      path: "/api/admin/studio/workflows",
      body: payload,
    });
  });
  test("maps execution creation without allowing a browser-selected path", () => {
    expect(studioAdminTarget({ action: "create-execution", workflowId: "wf/1" })).toEqual({
      method: "POST",
      path: "/api/admin/studio/executions",
      body: { workflowId: "wf/1" },
    });
  });
  test("maps manual node execution with encoded workflow and node IDs", () => {
    expect(studioAdminTarget({ action: "execute-node", workflowId: "wf/1", nodeId: "manual 1" })).toEqual({
      method: "POST",
      path: "/api/admin/studio/workflows/wf%2F1/nodes/manual%201/execute",
      body: undefined,
    });
  });
  test("maps HTTP execution, cURL import, and credential commands", () => {
    expect(studioAdminTarget({ action: "execute-http-request", workflowId: "wf/1", nodeId: "request 1" })).toEqual({
      method: "POST",
      path: "/api/admin/studio/workflows/wf%2F1/nodes/request%201/http-request",
      body: undefined,
    });
    expect(studioAdminTarget({ action: "import-curl", command: "curl https://example.com" })).toEqual({
      method: "POST",
      path: "/api/admin/studio/http-request/import-curl",
      body: { command: "curl https://example.com" },
    });
    expect(studioAdminTarget({ action: "delete-credential", id: "cred/1" })).toEqual({
      method: "DELETE",
      path: "/api/admin/studio/credentials/cred%2F1",
      body: undefined,
    });
  });
  test("maps previous-node execution, retrieval, and workflow deletion", () => {
    expect(
      studioAdminTarget({ action: "execute-previous", workflowId: "wf/1", nodeId: "request 1", sourceKey: "once" }),
    ).toEqual({
      method: "POST",
      path: "/api/admin/studio/workflows/wf%2F1/nodes/request%201/execute-previous",
      body: { triggerNodeId: undefined, sourceKey: "once" },
    });
    expect(studioAdminTarget({ action: "get-execution", id: "run/1" }).method).toBe("GET");
    expect(studioAdminTarget({ action: "delete-workflow", id: "wf/1" })).toEqual({
      method: "DELETE",
      path: "/api/admin/studio/workflows/wf%2F1",
      body: undefined,
    });
  });

  test("validates persisted node input and output", () => {
    const detail = parseStudioGraphExecutionDetail({
      execution: { id: "run-1", workflowId: "wf-1", workflow: "Flow", status: "completed" },
      stages: [
        {
          executionId: "run-1",
          position: 1,
          nodeId: "request",
          nodeType: "http-request",
          name: "HTTP Request",
          status: "completed",
          input: [{ json: { trigger: "manual" } }],
          output: [{ json: { statusCode: 200 } }],
          durationMs: 15,
        },
      ],
    });
    expect(detail.stages[0].input).toEqual([{ json: { trigger: "manual" } }]);
    expect(() =>
      parseStudioGraphExecutionDetail({
        execution: { id: "run-1", workflowId: "wf-1", workflow: "Flow", status: "completed" },
        stages: [{ nodeId: "request", status: "secret" }],
      }),
    ).toThrow();
  });
});
