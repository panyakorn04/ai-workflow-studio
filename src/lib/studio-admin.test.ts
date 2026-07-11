import { describe, expect, test } from "bun:test";
import { studioAdminTarget } from "./studio-admin";

describe("studio admin command mapping", () => {
  test("maps only known execution actions", () => {
    expect(studioAdminTarget({ action: "pause", id: "RUN/1" })).toEqual({ method: "POST", path: "/api/admin/studio/executions/RUN%2F1/pause", body: undefined });
  });
  test("maps workflow creation", () => {
    const payload = { name: "Flow", description: "", category: "Ops", status: "draft", nodes: ["Start"] };
    expect(studioAdminTarget({ action: "create-workflow", payload })).toEqual({ method: "POST", path: "/api/admin/studio/workflows", body: payload });
  });
  test("maps execution creation without allowing a browser-selected path", () => {
    expect(studioAdminTarget({ action: "create-execution", workflowId: "wf/1" })).toEqual({
      method: "POST", path: "/api/admin/studio/executions", body: { workflowId: "wf/1" },
    });
  });
});
