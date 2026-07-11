import { describe, expect, test } from "bun:test";
import { parseStudioOverview } from "./studio-api";

describe("studio API contract", () => {
  test("accepts the backend success envelope", () => {
    const result = parseStudioOverview({
      ok: true,
      data: {
        workflows: [{ id: "wf-1", name: "Research", description: "Research flow", category: "Research", status: "active", runs: 12, success: 99, updated: "now", nodes: ["Search"] }],
        executions: [{ id: "run-1", workflow: "Research", status: "running", started: "now", duration: "00:10", durationMs: 10000, cost: 0.01 }],
        stages: [{ name: "Search", detail: "Searching", state: "running" }],
      },
    });
    expect(result.workflows[0].id).toBe("wf-1");
    expect(result.source).toBe("backend");
  });

  test("rejects malformed backend data", () => {
    expect(() => parseStudioOverview({ ok: true, data: { workflows: [] } })).toThrow("Invalid studio overview response");
    expect(() => parseStudioOverview({
      ok: true,
      data: { workflows: [{}], executions: [{}], stages: [{}] },
    })).toThrow("Invalid studio overview response");
  });
});
